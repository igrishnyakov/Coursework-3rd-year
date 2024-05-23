const db = require('../db')
const { checkUserRole } = require('../utils/check-user-role')
const md5 = require('md5')

class ProfileController {
    async getVolunteer(req, res) {
        const id = req.params.id
        try {
            const result = await db.query('SELECT * FROM volunteer WHERE id = $1', [id])
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
        const { first_name, last_name, patronymic, email, phone_number, description, date_of_birth, skills, image_path, num_attended_events, volunteer_hours } = req.body
        try {
            const query = 'UPDATE volunteer SET first_name = $1, last_name = $2, patronymic = $3, email = $4, phone_number = $5, description = $6, date_of_birth = $7, skills = $8, image_path = $9, num_attended_events = $10, volunteer_hours = $11 WHERE id = $12 RETURNING *'
            const result = await db.query(query, [first_name, last_name, patronymic, email, phone_number, description, date_of_birth, skills, image_path, num_attended_events, volunteer_hours, id])
            res.json(result.rows[0])
        } catch (error) {
            res.status(500).send('Failed to update profile')
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
}

module.exports = new ProfileController()
