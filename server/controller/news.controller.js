const db = require('../db')
const { checkUserRole } = require('../utils/check-user-role')

class NewsController {
    async createNews(req, res) {
        const userRole = await checkUserRole(req)
        if (userRole !== 'org') {
            return res.status(403).send('You do not have rights to create/update news!')
        }

        const { id, title, text, publication_date, image_paths, organizer_id } = req.body // предполагается, что image_paths - это массив URL-адресов фотографий
        let newsItem

        try {
            await db.query('BEGIN') // начало транзакции

            if (id) {
                // Обновление существующей новости
                const updateQuery = 'UPDATE news SET title = $1, text = $2, publication_date = $3 WHERE id = $4 RETURNING *'
                const updateResult = await db.query(updateQuery, [title, text, publication_date, id])
                newsItem = updateResult.rows[0]

                // Получить текущие URL и ID изображений
                const currentImagesResult = await db.query(`
                SELECT image_news.id, image_news.image_path
                FROM image_news
                JOIN image_news_con ON image_news.id = image_news_con.image_id
                WHERE image_news_con.news_id = $1
                `, [id])
                const currentImages = currentImagesResult.rows.map(row => ({ id: row.id, path: row.image_path }))

                // Определить, какие изображения удалять
                const imagesToDelete = currentImages.filter(img => !image_paths.includes(img.path)).map(img => img.id)

                // Удаляем связи между новостью и изображениями, которые больше не должны быть связаны с новостью
                if (imagesToDelete.length > 0) {
                    await db.query('DELETE FROM image_news_con WHERE news_id = $1 AND image_id = ANY($2)', [id, imagesToDelete])
                }

                // Проверяем, связаны ли изображения с другими новостями
                const imagesStillConnectedResult = await db.query(`
                SELECT image_id
                FROM image_news_con
                WHERE image_id = ANY($1) AND news_id != $2
                GROUP BY image_id
                `, [imagesToDelete, id])
                const imagesStillConnected = imagesStillConnectedResult.rows.map(row => row.image_id)

                // Удаляем изображения, которые не связаны с другими новостями
                const imagesToReallyDelete = imagesToDelete.filter(imageId => !imagesStillConnected.includes(imageId))
                if (imagesToReallyDelete.length > 0) {
                    //await db.query('DELETE FROM image_news_con WHERE image_id = ANY($1)', [imagesToReallyDelete])
                    await db.query('DELETE FROM image_news WHERE id = ANY($1)', [imagesToReallyDelete])
                }

                // Определение изображений для добавления
                const existingImagesResult = await db.query('SELECT image_path, id FROM image_news WHERE image_path = ANY($1)', [image_paths])
                const existingImages = existingImagesResult.rows.reduce((acc, img) => ({ ...acc, [img.image_path]: img.id }), {})

                for (let imagePath of image_paths) {
                    let imageId;
                    if (existingImages[imagePath]) {
                        // Изображение уже существует, используем существующий id
                        imageId = existingImages[imagePath]
                    } else {
                        // Изображение не существует, добавляем новое
                        const insertImageQuery = 'INSERT INTO image_news (image_path) VALUES ($1) RETURNING id'
                        const imageResult = await db.query(insertImageQuery, [imagePath])
                        imageId = imageResult.rows[0].id
                    }

                    // Проверяем, связано ли изображение уже с новостью
                    const imageConnectedResult = await db.query('SELECT 1 FROM image_news_con WHERE news_id = $1 AND image_id = $2', [id, imageId])
                    if (imageConnectedResult.rowCount === 0) {
                        // Связываем изображение с новостью
                        const connectImageQuery = 'INSERT INTO image_news_con (news_id, image_id) VALUES ($1, $2)'
                        await db.query(connectImageQuery, [id, imageId])
                    }
                }
            } else {
                // Вставка новой новости
                const insertQuery = 'INSERT INTO news (title, text, publication_date, organizer_id) VALUES ($1, $2, $3, $4) RETURNING *'
                const insertResult = await db.query(insertQuery, [title, text, publication_date, organizer_id])
                newsItem = insertResult.rows[0]
                // Проверка наличия каждого изображения в базе данных
                const existingImagesResult = await db.query('SELECT image_path, id FROM image_news WHERE image_path = ANY($1)', [image_paths])
                const existingImages = existingImagesResult.rows.reduce((acc, img) => ({ ...acc, [img.image_path]: img.id }), {})

                for (let imagePath of image_paths) {
                    let imageId;
                    if (existingImages[imagePath]) {
                        // Изображение уже существует, используем существующий id
                        imageId = existingImages[imagePath]
                    } else {
                        // Изображение не существует, добавляем новое
                        const insertImageQuery = 'INSERT INTO image_news (image_path) VALUES ($1) RETURNING id'
                        const imageResult = await db.query(insertImageQuery, [imagePath])
                        imageId = imageResult.rows[0].id
                    }

                    // Связываем изображение с новостью
                    const connectImageQuery = 'INSERT INTO image_news_con (news_id, image_id) VALUES ($1, $2)'
                    await db.query(connectImageQuery, [newsItem.id, imageId])
                }
            }
            await db.query('COMMIT') // завершение транзакции
            res.json(newsItem)
        } catch (error) {
            await db.query('ROLLBACK') // откат в случае ошибки
            res.status(500).send('Failed to create or update news: ' + error.message)
        }
    }
    async getNews(req, res) {
        const items = await db.query(`
            SELECT news.id, news.title, news.text, news.publication_date, news.organizer_id,
                   array_agg(image_news.image_path) AS image_paths
            FROM news
                     LEFT JOIN image_news_con ON news.id = image_news_con.news_id
                     LEFT JOIN image_news ON image_news_con.image_id = image_news.id
            GROUP BY news.id
            ORDER BY news.id
        `)
        res.json(items.rows)
    }
    async getOneNews(req, res) {
        const id = req.params.id
        const item = await db.query(`
            SELECT news.id, news.title, news.text, news.publication_date, news.organizer_id,
                   array_agg(image_news.image_path) AS image_paths
            FROM news
                     LEFT JOIN image_news_con ON news.id = image_news_con.news_id
                     LEFT JOIN image_news ON image_news_con.image_id = image_news.id
            WHERE news.id = $1
            GROUP BY news.id
        `, [id])
        if (item.rows.length > 0) {
            res.json(item.rows[0])
        } else {
            res.status(404).send('News not found')
        }
    }
    async deleteNews(req, res) {
        const userRole = await checkUserRole(req)
        if (userRole !== 'org') {
            return res.status(403).send('You do not have rights to delete news!')
        }
        const id = req.params.id
        try {
            await db.query('BEGIN') // Начало транзакции

            // Получаем ID фотографий, которые нужно проверить на удаление
            const imageIdsResult = await db.query(`
            SELECT image_id FROM image_news_con WHERE news_id = $1
        `, [id])

            // Удаляем связи между новостью и фотографиями
            await db.query(`
            DELETE FROM image_news_con WHERE news_id = $1
        `, [id])

            // Удаляем фотографии, если они не связаны с другими новостями
            if (imageIdsResult.rows.length > 0) {
                const imageIds = imageIdsResult.rows.map(row => row.image_id);
                await db.query(`
                DELETE FROM image_news 
                WHERE id = ANY($1::int[]) AND NOT EXISTS (
                    SELECT 1 FROM image_news_con WHERE image_id = image_news.id
                )
            `, [imageIds])
            }

            // Удаляем новость
            await db.query(`
            DELETE FROM news WHERE id = $1
        `, [id])

            await db.query('COMMIT') // Фиксация транзакции
            res.json({ success: true, message: 'News and associated images have been deleted.' })
        } catch (error) {
            await db.query('ROLLBACK') // Откат в случае ошибки
            res.status(500).send('Failed to delete news: ' + error.message)
        }
    }
}

module.exports = new NewsController()