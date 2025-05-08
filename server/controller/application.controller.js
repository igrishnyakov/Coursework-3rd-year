const db = require('../db')
const { buildScores } = require('../utils/scoreBuilder');
const { checkUserRole } = require('../utils/check-user-role')

class ApplicationController {
    async getApplications(req, res) {
        try {
            const query = `
            SELECT
                a.id AS application_id,
                v.id AS volunteer_id,
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
                v.volunteer_hours,
                st.status,
                e.title,
                e.num_volunteers,
                ms.score,
                (SELECT COUNT(*) FROM designated_volunteer dv WHERE dv.event_id = e.id) +
                (SELECT COUNT(*) FROM application a2 WHERE a2.event_id = e.id AND a2.status_id = 3) AS current_volunteers
            FROM application a
            JOIN volunteer v ON v.id = a.volunteer_id
            LEFT JOIN volunteer_skill vs ON vs.volunteer_id = v.id
            LEFT JOIN skill s ON s.id = vs.skill_id
            JOIN status st ON st.id = a.status_id
            LEFT JOIN match_score ms ON ms.event_id = a.event_id AND ms.volunteer_id = v.id
            JOIN event e ON e.id = a.event_id
            GROUP BY a.id, v.id, st.status, e.id, ms.score
            ORDER BY a.id;
            `
            const applications = await db.query(query)
            res.json(applications.rows)
        } catch (error) {
            res.status(500).send('Failed to retrieve applications: ' + error.message)
        }
    }

    async getVolunteerApplications(req, res) {
        const volunteerId = req.params.volunteerId
        try {
            const query = `
                SELECT
                    a.id as application_id,
                    e.title as event_title,
                    array_agg(c.category) as categories,
                    e.image_path,
                    e.description,
                    e.start_date_time,
                    e.end_date_time,
                    e.num_volunteers,
                    e.tasks_volunteers,
                    e.conditions,
                    s.status,
                    ms.score
                FROM
                    application a
                        JOIN
                    event e ON a.event_id = e.id
                        JOIN
                    status s ON a.status_id = s.id
                        LEFT JOIN
                    match_score ms ON ms.event_id = e.id AND ms.volunteer_id = $1
                        LEFT JOIN
                    category_event ce ON e.id = ce.event_id
                        LEFT JOIN
                    category c ON ce.category_id = c.id
                WHERE
                    a.volunteer_id = $1
                GROUP BY
                    a.id, e.id, s.status, ms.score
            `
            const applications = await db.query(query, [volunteerId])
            res.json(applications.rows)
        } catch (error) {
            res.status(500).send('Failed to retrieve applications: ' + error.message)
        }
    }

    async changeApplicationStatus(req, res) {
        const applicationId = req.params.id
        const { statusId } = req.body
        try {
            const query = 'UPDATE application SET status_id = $1 WHERE id = $2 RETURNING *'
            const result = await db.query(query, [statusId, applicationId])
            res.json(result.rows[0])
        } catch (error) {
            res.status(500).send('Failed to update application status: ' + error.message)
        }
    }

    async cancelApplication(req, res) {
        const applicationId = req.params.id
        try {
            const query = 'DELETE FROM application WHERE id = $1 RETURNING *'
            const result = await db.query(query, [applicationId])
            // история волонтёра поменялась → пересчёт
            buildScores({ volunteerId: result.rows[0].volunteer_id }).catch(err => console.error('buildScores(application‑cancel)', err));
            res.json(result.rows[0])
        } catch (error) {
            res.status(500).send('Failed to cancel application: ' + error.message)
        }
    }
}

module.exports = new ApplicationController()