const db = require('../db')
const { checkUserRole } = require('../utils/check-user-role')
const md5 = require('md5')
const { buildScores } = require('../utils/scoreBuilder');

class ProfileController {
    async getVolunteer(req, res) {
        const id = req.params.id
        try {
            const result = await db.query(`
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
                v.volunteer_hours
        FROM volunteer v
        LEFT JOIN volunteer_skill vs ON vs.volunteer_id = v.id
        LEFT JOIN skill s ON s.id = vs.skill_id
        WHERE v.id = $1
        GROUP BY v.id
                `, [id])
            res.json(result.rows[0])
        } catch (error) {
            res.status(500).send('Failed to retrieve profile')
        }
    }

    async updateVolunteer(req, res) {
        const userRole = await checkUserRole(req)
        if (userRole !== 'vol') {
            return res.status(403).send('You do not have rights to update profile!')
        }

        const id = req.params.id
        const { first_name, last_name, patronymic, email, phone_number, description, date_of_birth, image_path, num_attended_events, volunteer_hours, skills = [] } = req.body
        try {
            await db.query('BEGIN');
            await db.query(
              `UPDATE volunteer
               SET first_name = $1, last_name = $2, patronymic = $3,
                   email = $4, phone_number = $5, description = $6,
                   date_of_birth = $7, image_path = $8,
                   num_attended_events = $9, volunteer_hours = $10
               WHERE id = $11`,
              [
                first_name, last_name, patronymic,
                email, phone_number, description, date_of_birth,
                image_path, num_attended_events, volunteer_hours,
                id
              ]
            );
            /* — перезаписываем список навыков — */
            await db.query('DELETE FROM volunteer_skill WHERE volunteer_id = $1', [id]);
            for (const skillId of skills) {
              await db.query(
                'INSERT INTO volunteer_skill (volunteer_id, skill_id) VALUES ($1, $2)',
                [id, skillId]
              );
            }
            await db.query('COMMIT');
            // навыки/часы изменились -> пересчёт балла подходимости для этого волонтёра
            buildScores({ volunteerId: id }).catch(err => console.error('buildScores(profile)', err));
            // возвращаем актуальный профиль
            const refreshed = await db.query(`
                SELECT
                    v.id,
                    v.first_name, v.last_name, v.patronymic,
                    v.image_path, v.email, v.phone_number,
                    v.description, v.date_of_birth,
                    COALESCE(
                        array_agg(s.skill)
                        FILTER (WHERE s.id IS NOT NULL), '{}'
                    ) AS skills,
                    v.num_attended_events, v.volunteer_hours
                FROM volunteer v
                LEFT JOIN volunteer_skill vs ON vs.volunteer_id = v.id
                LEFT JOIN skill s ON s.id = vs.skill_id
                WHERE v.id = $1
                GROUP BY v.id`,
                [id]
            );
            return res.json({ success: true, profile: refreshed.rows[0] });
        } catch (err) {
            await db.query('ROLLBACK');
            res.status(500).send('Failed to update profile: ' + err.message);
        }
    }

    async getOrganizer(req, res) {
        const id = req.params.id
        try {
            const result = await db.query('SELECT * FROM organizer WHERE id = $1', [id])
            res.json(result.rows[0])
        } catch (error) {
            res.status(500).send('Failed to retrieve profile')
        }
    }

    async updateOrganizer(req, res) {
        const userRole = await checkUserRole(req)
        if (userRole !== 'org') {
            return res.status(403).send('You do not have rights to update profile!')
        }

        const id = req.params.id
        const { first_name, last_name, patronymic, email, phone_number, description, date_of_birth, education, work_experience, image_path } = req.body
        try {
            const query = 'UPDATE organizer SET first_name = $1, last_name = $2, patronymic = $3, email = $4, phone_number = $5, description = $6, date_of_birth = $7, education = $8, work_experience = $9, image_path = $10 WHERE id = $11 RETURNING *'
            const result = await db.query(query, [first_name, last_name, patronymic, email, phone_number, description, date_of_birth, education, work_experience, image_path, id])
            res.json(result.rows[0])
        } catch (error) {
            res.status(500).send('Failed to update profile'+ error.message)
        }
    }

    async updatePassword(req, res) {
        const id = req.params.id
        const { currentPassword, newPassword } = req.body
        const userRole = await checkUserRole(req)
        let table

        if (userRole === 'vol') {
            table = 'volunteer'
        } else if (userRole === 'org') {
            table = 'organizer'
        } else {
            return res.status(403).send('You do not have rights to update password!')
        }

        try {
            const result = await db.query(`SELECT password FROM ${table} WHERE id = $1`, [id])
            const user = result.rows[0]

            if (!user || user.password !== md5(currentPassword)) {
                return res.status(403).send('Current password is incorrect')
            }

            const hashedPassword = md5(newPassword)
            const result2 = await db.query(`UPDATE ${table} SET password = $1 WHERE id = $2 RETURNING *`, [hashedPassword, id])
            res.json(result2.rows[0])
        } catch (error) {
            res.status(500).send('Failed to update password')
        }
    }

    async getSkills(req, res) {
        try {
          const skills = await db.query('SELECT * FROM skill');
          res.json(skills.rows);
        } catch (err) {
          res.status(500).send('Failed to retrieve skills');
        }
      }
}

module.exports = new ProfileController()
