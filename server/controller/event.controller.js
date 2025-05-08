const db = require('../db')
const { checkUserRole } = require('../utils/check-user-role')
const { buildClusters } = require('../utils/clusterBuilder')
const { buildScores } = require('../utils/scoreBuilder');
const PdfPrinter = require('pdfmake')
const fs = require('fs')
const path = require('path')
const moment = require('moment');

class EventController {
    async createEvent(req, res) {
        const userRole = await checkUserRole(req)
        if (userRole !== 'org') {
            return res.status(403).send('You do not have rights to create/update event!')
        }

        const { id, organizer_id, title, image_path, description, start_date_time, end_date_time, num_volunteers, tasks_volunteers, conditions, categories, rec_vol_hours } = req.body
        let eventItem
        // Получение id категорий на основе их названий
        const categoryQuery = 'SELECT id FROM category WHERE category = ANY($1)'
        const categoryResult = await db.query(categoryQuery, [categories])
        const categoryIds = categoryResult.rows.map(row => row.id)
        try {
            await db.query('BEGIN') // начало транзакции

            if (id) {
                // Обновление существующего мероприятия
                const updateQuery = 'UPDATE event SET organizer_id = $1, title = $2, image_path = $3, description = $4, start_date_time = $5, end_date_time = $6, num_volunteers = $7, tasks_volunteers = $8, conditions = $9, rec_vol_hours = $10 WHERE id = $11 RETURNING *'
                const updateResult = await db.query(updateQuery, [organizer_id, title, image_path, description, start_date_time, end_date_time, num_volunteers, tasks_volunteers, conditions, rec_vol_hours, id])
                eventItem = updateResult.rows[0]

                await db.query('DELETE FROM category_event WHERE event_id = $1', [id])
            } else {
                // Вставка нового мероприятия
                const insertQuery = 'INSERT INTO event (organizer_id, title, image_path, description, start_date_time, end_date_time, num_volunteers, tasks_volunteers, conditions, rec_vol_hours) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *'
                const insertResult = await db.query(insertQuery, [organizer_id, title, image_path, description, start_date_time, end_date_time, num_volunteers, tasks_volunteers, conditions, rec_vol_hours])
                eventItem = insertResult.rows[0]
            }

            for (const categoryId of categoryIds) {
                await db.query('INSERT INTO category_event (event_id, category_id) VALUES ($1, $2)', [eventItem.id, categoryId])
            }

            await db.query('COMMIT') // завершение транзакции

            // пересчет баллов только для этого мероприятия
            buildScores({ eventId: eventItem.id }).catch(err => console.error('buildScores(event)', err));
            // пересчет кластеров «в фоне»; если сломается — запишет в лог, пользователь всё равно получит сохранённое мероприятие
            buildClusters().catch(err => console.error('buildClusters', err));
            res.json(eventItem)
        } catch (error) {
            await db.query('ROLLBACK') // откат в случае ошибки
            res.status(500).send('Failed to create or update event: ' + error.message)
        }
    }
    async getEvents(req, res) {
        const { volunteerId } = req.query;           // <- если прилетел id волонтёра
        try {
            const params = [];
            const query = `
                SELECT  e.*,
                    array_agg(c.category) AS categories
                    ${volunteerId ? ', ms.score' : ''}
                FROM event e
                LEFT JOIN category_event ce ON ce.event_id = e.id
                LEFT JOIN category c ON c.id = ce.category_id
                ${volunteerId
                    ? 'LEFT JOIN match_score ms ON ms.event_id = e.id AND ms.volunteer_id = $1'
                    : ''}
                GROUP BY e.id ${volunteerId ? ', ms.score' : ''}
                ORDER BY e.start_date_time DESC`;

            if (volunteerId) params.push(volunteerId);
            const items = await db.query(query, params);
            res.json(items.rows);
        } catch (err) {
            res.status(500).send('Failed to retrieve events: ' + err.message);
        }
    }
    async getOneEvent(req, res) {
        const id = req.params.id
        try {
            const query = `
        SELECT e.*, array_agg(c.category) as categories
        FROM event e
        LEFT JOIN category_event ce ON e.id = ce.event_id
        LEFT JOIN category c ON ce.category_id = c.id
        WHERE e.id = $1
        GROUP BY e.id`
            const item = await db.query(query, [id])
            if (item.rows.length > 0) {
                res.json(item.rows[0])
            } else {
                res.status(404).send('Event not found')
            }
        } catch (error) {
            res.status(500).send('Failed to retrieve event: ' + error.message)
        }
    }
    async deleteEvent(req, res) {
        const userRole = await checkUserRole(req)
        if (userRole !== 'org') {
            return res.status(403).send('You do not have rights to delete event!')
        }
        const id = req.params.id
        try {
            const eventCheckResult = await db.query('SELECT id FROM event WHERE id = $1', [id])
            if (eventCheckResult.rows.length === 0) {
                return res.status(404).send('Event not found')
            }
            await db.query('BEGIN') // начало транзакции
            await db.query('DELETE FROM category_event WHERE event_id = $1', [id])
            await db.query(`DELETE FROM event WHERE id = $1`, [id])
            await db.query('COMMIT') // фиксация транзакции
             
            // удаляем все строки из match_score для удаляемого события
            await db.query('DELETE FROM match_score WHERE event_id = $1', [id]);
            // пересчет тайм кластеров
            buildClusters().catch(err => console.error('buildClusters', err)); 
            res.json({ success: true, message: 'Event have been deleted.' })
        } catch (error) {
            await db.query('ROLLBACK') // откат в случае ошибки
            res.status(500).send('Failed to delete event: ' + error.message)
        }
    }
    async getCategories(req, res) {
        try {
            const categories = await db.query('SELECT * FROM category')
            res.json(categories.rows)
        } catch (error) {
            res.status(500).send('Failed to retrieve categories: ' + error.message)
        }
    }

    async getEventVolunteers(req, res) {
        const eventId = req.params.id
        try {
            const query = `
            SELECT  v.id,
                    v.first_name,
                    v.last_name,
                    v.patronymic,
                    v.image_path,
                    v.email,
                    v.phone_number,
                    v.description,
                    v.date_of_birth,
                    COALESCE(
                        array_agg(s.skill)
                        FILTER (WHERE s.id IS NOT NULL), '{}'
                    ) AS skills,
                    v.num_attended_events,
                    v.volunteer_hours,
                    ms.score
            FROM volunteer v
            LEFT JOIN volunteer_skill vs ON vs.volunteer_id = v.id
            LEFT JOIN skill s ON s.id = vs.skill_id
            JOIN (
                SELECT volunteer_id FROM designated_volunteer WHERE event_id = $1
                UNION
                SELECT volunteer_id FROM application WHERE event_id = $1 AND status_id = 3
            ) AS combined ON v.id = combined.volunteer_id
            LEFT JOIN match_score ms ON ms.event_id = $1 AND ms.volunteer_id = v.id
            GROUP BY v.id, ms.score
            `
            const volunteers = await db.query(query, [eventId])
            res.json(volunteers.rows)
        } catch (error) {
            res.status(500).send('Failed to retrieve volunteers: ' + error.message)
        }
    }
    async getAllVolunteers(req, res) {
        try {
            const { eventId } = req.query;
            const params   = [];
            const query = `
            SELECT  v.id,
                    v.first_name,
                    v.last_name,
                    v.patronymic,
                    v.image_path,
                    v.email,
                    v.phone_number,
                    v.description,
                    v.date_of_birth,
                    COALESCE(
                        array_agg(s.skill ORDER BY s.skill)
                        FILTER (WHERE s.id IS NOT NULL), '{}'
                    ) AS skills,
                    v.num_attended_events,
                    v.volunteer_hours
                    ${eventId ? ', ms.score' : ''}
            FROM volunteer v
            LEFT JOIN volunteer_skill vs ON vs.volunteer_id = v.id
            LEFT JOIN skill s ON s.id = vs.skill_id
            ${eventId
                ? 'LEFT JOIN match_score ms ON ms.volunteer_id = v.id AND ms.event_id = $1'
                : ''}
            GROUP BY v.id ${eventId ? ', ms.score' : ''}
            `
            if (eventId) params.push(eventId);
            const volunteers = await db.query(query, params);
            res.json(volunteers.rows)
        } catch (error) {
            res.status(500).send('Failed to retrieve all volunteers: ' + error.message);
        }
    }
    async addVolunteerToEvent(req, res) {
        const userRole = await checkUserRole(req)
        if (userRole !== 'org') {
            return res.status(403).send('You do not have rights to create/update event!')
        }
        const { eventId, volunteerIds } = req.body
        try {
            await db.query('BEGIN');
            for (const volunteerId of volunteerIds) {
                await db.query('INSERT INTO designated_volunteer (volunteer_id, event_id) VALUES ($1, $2)', [volunteerId, eventId]);
            }
            await db.query('COMMIT')
            res.json({ success: true })
        } catch (error) {
            await db.query('ROLLBACK')
            res.status(500).send('Failed to add volunteers to event: ' + error.message)
        }
    }
    async removeVolunteerFromEvent(req, res) {
        const userRole = await checkUserRole(req)
        if (userRole !== 'org') {
            return res.status(403).send('You do not have rights to create/update event!')
        }
        const { eventId, volunteerId } = req.body;
        try {
            await db.query('BEGIN');
            await db.query('DELETE FROM designated_volunteer WHERE volunteer_id = $1 AND event_id = $2', [volunteerId, eventId]);
            await db.query('UPDATE application SET status_id = 2 WHERE volunteer_id = $1 AND event_id = $2', [volunteerId, eventId]);
            await db.query('COMMIT');
            res.json({ success: true });
        } catch (error) {
            await db.query('ROLLBACK');
            res.status(500).send('Failed to remove volunteer from event: ' + error.message);
        }
    }

    async applyForEvent(req, res) {
        const userRole = await checkUserRole(req)
        if (userRole !== 'vol') {
            return res.status(403).send('You do not have rights to apply for event!')
        }

        const volunteerId = req.body.volunteerId
        const { id: eventId } = req.params

        try {
            const query = 'INSERT INTO application (volunteer_id, event_id, status_id) VALUES ($1, $2, $3) RETURNING *'
            const result = await db.query(query, [volunteerId, eventId, 1])
            // история изменилась → пересчёт для одного волонтёра
            buildScores({ volunteerId }).catch(err => console.error('buildScores(vol‑apply)', err));
            res.json(result.rows[0])
        } catch (error) {
            res.status(500).send('Failed to apply for event: ' + error.message)
        }
    }

    async cancelApplication(req, res) {
        const userRole = await checkUserRole(req)
        if (userRole !== 'vol') {
            return res.status(403).send('You do not have rights to cancel application for event!')
        }

        const volunteerId = req.body.volunteerId
        const { id: eventId } = req.params

        try {
            const query = 'DELETE FROM application WHERE volunteer_id = $1 AND event_id = $2 RETURNING *'
            const result = await db.query(query, [volunteerId, eventId])
            // заявка снята → пересчёт для одного волонтёра
            buildScores({ volunteerId }).catch(err => console.error('buildScores(vol‑cancel)', err));
            res.json(result.rows[0])
        } catch (error) {
            res.status(500).send('Failed to cancel application for event: ' + error.message)
        }
    }

    async getVolunteerParticipationStatus(req, res) {
        const { id: eventId, volunteerId } = req.params
        try {
            const applicationQuery = 'SELECT status FROM application JOIN status ON application.status_id = status.id WHERE volunteer_id = $1 AND event_id = $2'
            const applicationResult = await db.query(applicationQuery, [volunteerId, eventId])

            if (applicationResult.rows.length > 0) {
                return res.json(applicationResult.rows[0])
            }

            const designationQuery = 'SELECT 1 FROM designated_volunteer WHERE volunteer_id = $1 AND event_id = $2'
            const designationResult = await db.query(designationQuery, [volunteerId, eventId])

            if (designationResult.rows.length > 0) {
                return res.json({ status: 'designated' })
            }

            res.json({ status: null })
        } catch (error) {
            res.status(500).send('Failed to retrieve participation status for event: ' + error.message)
        }
    }

    async generatePdfReport(req, res) {
        const eventId = req.params.id;

        try {
            const eventQuery = `
                SELECT e.*, array_agg(c.category) as categories
                FROM event e
                         LEFT JOIN category_event ce ON e.id = ce.event_id
                         LEFT JOIN category c ON ce.category_id = c.id
                WHERE e.id = $1
                GROUP BY e.id
            `;
            const eventResult = await db.query(eventQuery, [eventId]);

            if (eventResult.rows.length === 0) {
                return res.status(404).send('Event not found');
            }

            const event = eventResult.rows[0];

            const volunteersQuery = `
                SELECT v.*
                FROM volunteer v
                         JOIN (
                    SELECT volunteer_id FROM designated_volunteer WHERE event_id = $1
                    UNION
                    SELECT volunteer_id FROM application WHERE event_id = $1 AND status_id = 3
                ) AS combined ON v.id = combined.volunteer_id
            `;
            const volunteersResult = await db.query(volunteersQuery, [eventId]);

            const volunteers = volunteersResult.rows;

            // Define the PDF document structure
            const fonts = {
                NotoSans: {
                    normal: path.join(__dirname, '..', 'fonts', 'NotoSans-Regular.ttf'),
                    bold: path.join(__dirname, '..', 'fonts', 'NotoSans-Bold.ttf'),
                    italics: path.join(__dirname, '..', 'fonts', 'NotoSans-Italic.ttf'),
                    bolditalics: path.join(__dirname, '..', 'fonts', 'NotoSans-BoldItalic.ttf')
                }
            };
            const printer = new PdfPrinter(fonts);
            const docDefinition = {
                content: [
                    { text: event.title, style: 'header' },
                    { text: `Категории: ${event.categories.join(', ')}`, style: 'subheader' },
                    { text: `Описание: ${event.description}`, style: 'subheader' },
                    { text: `Период проведения: ${moment(event.start_date_time).format('D MMMM YYYY, HH:mm')} - ${moment(event.end_date_time).format('D MMMM YYYY, HH:mm')}`, style: 'subheader' },
                    { text: `Количество волонтеров: ${event.num_volunteers}`, style: 'subheader' },
                    { text: `Задачи волонтеров: ${event.tasks_volunteers}`, style: 'subheader' },
                    { text: `Условия: ${event.conditions}`, style: 'subheader' },
                    { text: 'Список волонтеров:', style: 'header' },
                    ...volunteers.map(volunteer => ({
                        text: `${volunteer.last_name} ${volunteer.first_name} (${moment(volunteer.date_of_birth).format('DD.MM.YYYY')})`,
                        style: 'subheader'
                    }))
                ],
                styles: {
                    header: {
                        fontSize: 18,
                        bold: true,
                        margin: [0, 10, 0, 10]
                    },
                    subheader: {
                        fontSize: 14,
                        margin: [0, 5, 0, 5]
                    }
                },
                defaultStyle: {
                    font: 'NotoSans'
                }
            };
            const pdfDoc = printer.createPdfKitDocument(docDefinition);
            const chunks = [];
            pdfDoc.on('data', chunk => {
                chunks.push(chunk);
            });
            pdfDoc.on('end', () => {
                const result = Buffer.concat(chunks);
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=report_${eventId}.pdf`);
                res.send(result);
            });
            pdfDoc.end();

        } catch (error) {
            res.status(500).send('Failed to generate report: ' + error.message);
        }
    }
}

module.exports = new EventController()