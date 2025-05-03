const db = require('../db')
const md5 = require('md5')
const pidCrypt = require('pidcrypt')
require('pidcrypt/aes_cbc')

const aes = new pidCrypt.AES.CBC()
const cryptoKey = 'это_ключик_для_шифрования))'

class AuthController {
    async checkSession(req, res) {
        const sessionCookie = req.cookies['APP_SESSION']
        const userEmail = aes.decryptText(sessionCookie, cryptoKey)
        const resultVol = await db.query(`
            SELECT  V.id,
                    V.first_name,
                    V.last_name,
                    V.patronymic,
                    V.image_path,
                    V.email,
                    V.phone_number,
                    V.description,
                    V.date_of_birth,
                    COALESCE(
                        array_agg(S.skill)
                        FILTER (WHERE S.id IS NOT NULL), '{}'
                    ) AS skills,
                    V.num_attended_events,
                    V.volunteer_hours
            FROM volunteer V
            LEFT JOIN volunteer_skill VS ON VS.volunteer_id = V.id
            LEFT JOIN skill S ON S.id = VS.skill_id
            WHERE V.email = $1
            GROUP BY V.id
        `, [userEmail]
        )
        if (resultVol.rows[0]) {
            res.json({
                success: true,
                userInfo: {
                    id: resultVol.rows[0].id,
                    role: 'vol',
                    first_name: resultVol.rows[0].first_name,
                    last_name: resultVol.rows[0].last_name,
                    patronymic: resultVol.rows[0].patronymic,
                    image_path: resultVol.rows[0].image_path,
                    email: resultVol.rows[0].email,
                    phone_number: resultVol.rows[0].phone_number,
                    description: resultVol.rows[0].description,
                    date_of_birth: resultVol.rows[0].date_of_birth,
                    skills: resultVol.rows[0].skills,
                    num_attended_events: resultVol.rows[0].num_attended_events,
                    volunteer_hours: resultVol.rows[0].volunteer_hours
                }
            })
        } else {
            const resultOrg = await db.query(
                'SELECT O.id, O.first_name, O.last_name, O.patronymic, O.image_path, O.email, O.phone_number, O.description, O.date_of_birth, O.education, O.work_experience FROM organizer O WHERE O.email = $1',
                [userEmail]
            )
            if (resultOrg.rows[0]) {
                res.json({
                    success: true,
                    userInfo: {
                        id: resultOrg.rows[0].id,
                        role: 'org',
                        first_name: resultOrg.rows[0].first_name,
                        last_name: resultOrg.rows[0].last_name,
                        patronymic: resultOrg.rows[0].patronymic,
                        image_path: resultOrg.rows[0].image_path,
                        email: resultOrg.rows[0].email,
                        phone_number: resultOrg.rows[0].phone_number,
                        description: resultOrg.rows[0].description,
                        date_of_birth: resultOrg.rows[0].date_of_birth,
                        education: resultOrg.rows[0].education,
                        work_experience: resultOrg.rows[0].work_experience
                    }
                })
            }
            else {
                res.status(401).json({success: false})
            }
        }
    }
    async login(req, res) {
        const userRecord = req.body
        const resultVol = await db.query(`
            SELECT  V.id,
                    V.first_name,
                    V.last_name,
                    V.patronymic,
                    V.image_path,
                    V.email,
                    V.phone_number,
                    V.description,
                    V.date_of_birth,
                    COALESCE(
                        array_agg(S.skill)
                        FILTER (WHERE S.id IS NOT NULL), '{}'
                    ) AS skills,
                    V.num_attended_events,
                    V.volunteer_hours
            FROM volunteer V
            LEFT JOIN volunteer_skill VS ON VS.volunteer_id = V.id
            LEFT JOIN skill S ON S.id = VS.skill_id
            WHERE V.email = $1 AND V.password = $2
            GROUP BY V.id
            `,
            [userRecord.email, md5(userRecord.password)]
        )
        let response
        if (resultVol.rows[0]) {
            res.cookie('APP_SESSION', aes.encryptText(userRecord.email, cryptoKey), {
                httpOnly: true
            })
            response = {
                success: true,
                userInfo: {
                    id: resultVol.rows[0].id,
                    role: 'vol',
                    first_name: resultVol.rows[0].first_name,
                    last_name: resultVol.rows[0].last_name,
                    patronymic: resultVol.rows[0].patronymic,
                    image_path: resultVol.rows[0].image_path,
                    email: resultVol.rows[0].email,
                    phone_number: resultVol.rows[0].phone_number,
                    description: resultVol.rows[0].description,
                    date_of_birth: resultVol.rows[0].date_of_birth,
                    skills: resultVol.rows[0].skills,
                    num_attended_events: resultVol.rows[0].num_attended_events,
                    volunteer_hours: resultVol.rows[0].volunteer_hours
                }
            }
            res.json(response)
        } else {
            const resultOrg = await db.query(
                'SELECT O.id, O.first_name, O.last_name, O.patronymic, O.image_path, O.email, O.phone_number, O.description, O.date_of_birth, O.education, O.work_experience FROM organizer O WHERE O.email = $1 AND O.password = $2',
                [userRecord.email, md5(userRecord.password)]
            )
            if (resultOrg.rows[0]) {
                res.cookie('APP_SESSION', aes.encryptText(userRecord.email, cryptoKey), {
                    httpOnly: true
                })
                response = {
                    success: true,
                    userInfo: {
                        id: resultOrg.rows[0].id,
                        role: 'org',
                        first_name: resultOrg.rows[0].first_name,
                        last_name: resultOrg.rows[0].last_name,
                        patronymic: resultOrg.rows[0].patronymic,
                        image_path: resultOrg.rows[0].image_path,
                        email: resultOrg.rows[0].email,
                        phone_number: resultOrg.rows[0].phone_number,
                        description: resultOrg.rows[0].description,
                        date_of_birth: resultOrg.rows[0].date_of_birth,
                        education: resultOrg.rows[0].education,
                        work_experience: resultOrg.rows[0].work_experience
                    }
                }
                res.json(response)
            }
            else {
                response = { success: false }
                res.status(401).json(response)
            }
        }
    }
    async register(req, res) {
        const userRecord = req.body
        const checkResult = await db.query('SELECT * FROM volunteer WHERE email = $1', [userRecord.email])
        let response
        if (!checkResult.rows[0]) {
            await db.query('INSERT INTO volunteer (first_name, last_name, date_of_birth, email, password) values ($1, $2, $3, $4, $5)', [
                userRecord.first_name,
                userRecord.last_name,
                userRecord.date_of_birth,
                userRecord.email,
                md5(userRecord.password)
            ])
            const result = await db.query(
                'SELECT V.id, V.email, V.first_name, V.last_name, V.date_of_birth FROM volunteer V WHERE V.email = $1',
                [userRecord.email]
            )
            res.cookie('APP_SESSION', aes.encryptText(userRecord.email, cryptoKey), {
                httpOnly: true
            })
            response = {
                success: true,
                userInfo: {
                    id: result.rows[0].id,
                    email: result.rows[0].email,
                    first_name: result.rows[0].first_name,
                    last_name: result.rows[0].last_name,
                    date_of_birth: result.rows[0].date_of_birth,
                    role: 'vol'
                }
            }
            res.json(response)
        } else {
            response = { success: false }
            res.status(409).json(response)
        }
    }
    async logout(req, res) {
        res.clearCookie('APP_SESSION')
        res.json({ success: true })
    }
}

module.exports = new AuthController()