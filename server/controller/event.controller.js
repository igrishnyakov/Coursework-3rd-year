const db = require('../db')
const { checkUserRole } = require('../utils/check-user-role')

class EventController {
    async createEvent(req, res) {
        const userRole = await checkUserRole(req)
        if (userRole !== 'org') {
            return res.status(403).send('You do not have rights to create/update event!')
        }

        const { id, organizer_id, title, image_path, description, start_date_time, end_date_time, num_volunteers, tasks_volunteers, conditions, categories } = req.body
        let eventItem
        // Получение id категорий на основе их названий
        const categoryQuery = 'SELECT id FROM category WHERE category = ANY($1)'
        const categoryResult = await db.query(categoryQuery, [categories])
        const categoryIds = categoryResult.rows.map(row => row.id)
        try {
            await db.query('BEGIN') // начало транзакции

            if (id) {
                // Обновление существующего отчета
                const updateQuery = 'UPDATE event SET organizer_id = $1, title = $2, image_path = $3, description = $4, start_date_time = $5, end_date_time = $6, num_volunteers = $7, tasks_volunteers = $8, conditions = $9 WHERE id = $10 RETURNING *'
                const updateResult = await db.query(updateQuery, [organizer_id, title, image_path, description, start_date_time, end_date_time, num_volunteers, tasks_volunteers, conditions, id])
                eventItem = updateResult.rows[0]

                await db.query('DELETE FROM category_event WHERE event_id = $1', [id])
            } else {
                // Вставка нового отчета
                const insertQuery = 'INSERT INTO event (organizer_id, title, image_path, description, start_date_time, end_date_time, num_volunteers, tasks_volunteers, conditions) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *'
                const insertResult = await db.query(insertQuery, [organizer_id, title, image_path, description, start_date_time, end_date_time, num_volunteers, tasks_volunteers, conditions])
                eventItem = insertResult.rows[0]
            }

            for (const categoryId of categoryIds) {
                await db.query('INSERT INTO category_event (event_id, category_id) VALUES ($1, $2)', [eventItem.id, categoryId])
            }

            await db.query('COMMIT') // завершение транзакции
            res.json(eventItem)
        } catch (error) {
            await db.query('ROLLBACK') // откат в случае ошибки
            res.status(500).send('Failed to create or update event: ' + error.message)
        }
    }
    async getEvents(req, res) {
        try {
            const query = `
        SELECT e.*, array_agg(c.category) as categories
        FROM event e
        LEFT JOIN category_event ce ON e.id = ce.event_id
        LEFT JOIN category c ON ce.category_id = c.id
        GROUP BY e.id
        ORDER BY e.id`
            const items = await db.query(query)
            res.json(items.rows)
        } catch (error) {
            res.status(500).send('Failed to retrieve events: ' + error.message)
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
            await db.query('BEGIN') // начало транзакции
            await db.query('DELETE FROM category_event WHERE event_id = $1', [id])
            await db.query(`DELETE FROM event WHERE id = $1`, [id])
            await db.query('COMMIT') // фиксация транзакции
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
            SELECT *
            FROM volunteer v
            JOIN (
                SELECT volunteer_id FROM designated_volunteer WHERE event_id = $1
                UNION
                SELECT volunteer_id FROM application WHERE event_id = $1 AND status_id = 3
            ) AS combined ON v.id = combined.volunteer_id`
            const volunteers = await db.query(query, [eventId])
            res.json(volunteers.rows)
        } catch (error) {
            res.status(500).send('Failed to retrieve volunteers: ' + error.message)
        }
    }
    async getAllVolunteers(req, res) {
        try {
            const query = 'SELECT * FROM volunteer'
            const volunteers = await db.query(query)
            res.json(volunteers.rows)
        } catch (error) {
            res.status(500).send('Failed to retrieve all volunteers: ' + error.message);
        }
    }
    async addVolunteerToEvent(req, res) {
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
}

module.exports = new EventController()