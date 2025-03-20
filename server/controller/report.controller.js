const db = require('../db')
const { checkUserRole } = require('../utils/check-user-role')

class ReportController {
    async createReport(req, res) {
        const userRole = await checkUserRole(req)
        if (userRole !== 'org') {
            return res.status(403).send('You do not have rights to create/update report!')
        }

        const { id, title, text, publication_date, event_id, image_paths, organizer_id } = req.body // предполагается, что image_paths - это массив URL-адресов фотографий
        let reportItem

        try {
            await db.query('BEGIN') // начало транзакции

            if (id) {
                // Обновление существующего отчета
                const updateQuery = 'UPDATE report SET title = $1, text = $2, publication_date = $3 WHERE id = $4 RETURNING *'
                const updateResult = await db.query(updateQuery, [title, text, publication_date, id])
                reportItem = updateResult.rows[0]

                // Получить текущие URL и ID изображений
                const currentImagesResult = await db.query(`
                SELECT image_report.id, image_report.image_path
                FROM image_report
                JOIN image_report_con ON image_report.id = image_report_con.image_id
                WHERE image_report_con.report_id = $1
                `, [id])
                const currentImages = currentImagesResult.rows.map(row => ({ id: row.id, path: row.image_path }))

                // Определить, какие изображения удалять
                const imagesToDelete = currentImages.filter(img => !image_paths.includes(img.path)).map(img => img.id)

                // Удаляем связи между отчетом и изображениями, которые больше не должны быть связаны с отчетом
                if (imagesToDelete.length > 0) {
                    await db.query('DELETE FROM image_report_con WHERE report_id = $1 AND image_id = ANY($2)', [id, imagesToDelete])
                }

                // Проверяем, связаны ли изображения с другими отчетами
                const imagesStillConnectedResult = await db.query(`
                SELECT image_id
                FROM image_report_con
                WHERE image_id = ANY($1) AND report_id != $2
                GROUP BY image_id
                `, [imagesToDelete, id])
                const imagesStillConnected = imagesStillConnectedResult.rows.map(row => row.image_id)

                // Удаляем изображения, которые не связаны с другими отчетами
                const imagesToReallyDelete = imagesToDelete.filter(imageId => !imagesStillConnected.includes(imageId))
                if (imagesToReallyDelete.length > 0) {
                    await db.query('DELETE FROM image_report WHERE id = ANY($1)', [imagesToReallyDelete])
                }

                // Определение изображений для добавления
                const existingImagesResult = await db.query('SELECT image_path, id FROM image_report WHERE image_path = ANY($1)', [image_paths])
                const existingImages = existingImagesResult.rows.reduce((acc, img) => ({ ...acc, [img.image_path]: img.id }), {})

                for (let imagePath of image_paths) {
                    let imageId;
                    if (existingImages[imagePath]) {
                        // Изображение уже существует, используем существующий id
                        imageId = existingImages[imagePath]
                    } else {
                        // Изображение не существует, добавляем новое
                        const insertImageQuery = 'INSERT INTO image_report (image_path) VALUES ($1) RETURNING id'
                        const imageResult = await db.query(insertImageQuery, [imagePath])
                        imageId = imageResult.rows[0].id
                    }

                    // Проверяем, связано ли изображение уже с отчетом
                    const imageConnectedResult = await db.query('SELECT 1 FROM image_report_con WHERE report_id = $1 AND image_id = $2', [id, imageId])
                    if (imageConnectedResult.rowCount === 0) {
                        // Связываем изображение с отчетом
                        const connectImageQuery = 'INSERT INTO image_report_con (report_id, image_id) VALUES ($1, $2)'
                        await db.query(connectImageQuery, [id, imageId])
                    }
                }
            } else {
                // Вставка нового отчета
                const insertQuery = 'INSERT INTO report (title, text, publication_date, event_id, organizer_id) VALUES ($1, $2, $3, $4, $5) RETURNING *'
                const insertResult = await db.query(insertQuery, [title, text, publication_date, event_id, organizer_id])
                reportItem = insertResult.rows[0]
                // Проверка наличия каждого изображения в базе данных
                const existingImagesResult = await db.query('SELECT image_path, id FROM image_report WHERE image_path = ANY($1)', [image_paths])
                const existingImages = existingImagesResult.rows.reduce((acc, img) => ({ ...acc, [img.image_path]: img.id }), {})

                for (let imagePath of image_paths) {
                    let imageId;
                    if (existingImages[imagePath]) {
                        // Изображение уже существует, используем существующий id
                        imageId = existingImages[imagePath]
                    } else {
                        // Изображение не существует, добавляем новое
                        const insertImageQuery = 'INSERT INTO image_report (image_path) VALUES ($1) RETURNING id'
                        const imageResult = await db.query(insertImageQuery, [imagePath])
                        imageId = imageResult.rows[0].id
                    }

                    // Связываем изображение с новостью
                    const connectImageQuery = 'INSERT INTO image_report_con (report_id, image_id) VALUES ($1, $2)'
                    await db.query(connectImageQuery, [reportItem.id, imageId])
                }
            }
            await db.query('COMMIT') // завершение транзакции
            res.json(reportItem)
        } catch (error) {
            await db.query('ROLLBACK') // откат в случае ошибки
            res.status(500).send('Failed to create or update report: ' + error.message)
        }
    }
    async getReports(req, res) {
        const items = await db.query(`
            SELECT report.id, report.title, report.text, report.publication_date, report.event_id, report.organizer_id,
                   array_agg(image_report.image_path) AS image_paths
            FROM report
                     LEFT JOIN image_report_con ON report.id = image_report_con.report_id
                     LEFT JOIN image_report ON image_report_con.image_id = image_report.id
            GROUP BY report.id
            ORDER BY report.publication_date DESC
        `)
        res.json(items.rows)
    }
    async getOneReport(req, res) {
        const id = req.params.id
        const item = await db.query(`
            SELECT report.id, report.title, report.text, report.publication_date, report.event_id, report.organizer_id,
                   array_agg(image_report.image_path) AS image_paths
            FROM report
                     LEFT JOIN image_report_con ON report.id = image_report_con.report_id
                     LEFT JOIN image_report ON image_report_con.image_id = image_report.id
            WHERE report.id = $1
            GROUP BY report.id
        `, [id])
        if (item.rows.length > 0) {
            res.json(item.rows[0])
        } else {
            res.status(404).send('Report not found')
        }
    }
    async deleteReport(req, res) {
        const userRole = await checkUserRole(req)
        if (userRole !== 'org') {
            return res.status(403).send('You do not have rights to delete report!')
        }
        const id = req.params.id
        try {
            await db.query('BEGIN') // Начало транзакции

            // Получаем ID фотографий, которые нужно проверить на удаление
            const imageIdsResult = await db.query(`
            SELECT image_id FROM image_report_con WHERE report_id = $1
        `, [id])

            // Удаляем связи между отчетом и фотографиями
            await db.query(`
            DELETE FROM image_report_con WHERE report_id = $1
        `, [id])

            // Удаляем фотографии, если они не связаны с другими отчетами
            if (imageIdsResult.rows.length > 0) {
                const imageIds = imageIdsResult.rows.map(row => row.image_id);
                await db.query(`
                DELETE FROM image_report 
                WHERE id = ANY($1::int[]) AND NOT EXISTS (
                    SELECT 1 FROM image_report_con WHERE image_id = image_report.id
                )
            `, [imageIds])
            }

            // Удаляем отчет
            await db.query(`
            DELETE FROM report WHERE id = $1
        `, [id])

            await db.query('COMMIT') // Фиксация транзакции
            res.json({ success: true, message: 'Report and associated images have been deleted.' })
        } catch (error) {
            await db.query('ROLLBACK') // Откат в случае ошибки
            res.status(500).send('Failed to delete report: ' + error.message)
        }
    }
}

module.exports = new ReportController()