const db = require('../db')
const md5 = require('md5')
const pidCrypt = require('pidcrypt')
require('pidcrypt/aes_cbc')

const aes = new pidCrypt.AES.CBC()
const cryptoKey = 'это_ключик_для_шифрования))'

class AuthController {
    async checkSession(req, res) {
        const sessionCookie = req.cookies['APP_SESSION']
        const userName = aes.decryptText(sessionCookie, cryptoKey)
        const result = await db.query(
            'SELECT U.id, U.login, R.name as role FROM users U ' +
            'INNER JOIN roles R ON R.id = U.role ' +
            'WHERE U.login = $1',
            [userName]
        )
        if (result.rows[0]) {
            res.json({
                success: true,
                userInfo: {
                    id: result.rows[0].id,
                    login: result.rows[0].login,
                    role: result.rows[0].role
                }
            })
        } else {
            res.json({
                success: false
            })
        }
    }
    async login(req, res) {
        const userRecord = req.body
        const result = await db.query(
            'SELECT U.id, U.login, R.name as role FROM users U ' +
            'INNER JOIN roles R ON R.id = U.role ' +
            'WHERE U.login = $1 AND U.password = $2',
            [userRecord.login, md5(userRecord.password)]
        )
        let response
        if (result.rows[0]) {
            res.cookie('APP_SESSION', aes.encryptText(userRecord.login, cryptoKey), {
                httpOnly: true
            })
            response = {
                success: true,
                userInfo: {
                    id: result.rows[0].id,
                    login: result.rows[0].login,
                    role: result.rows[0].role
                }
            }
        } else {
            response = { success: false }
        }
        res.json(response)
    }
    async register(req, res) {
        const userRecord = req.body
        const checkResult = await db.query('SELECT * FROM users WHERE login = $1', [userRecord.login])
        let response
        if (!checkResult.rows[0]) {
            await db.query('INSERT INTO users (login, password) values ($1, $2)', [
                userRecord.login,
                md5(userRecord.password)
            ])
            const result = await db.query(
                'SELECT U.id, U.login, R.name as role FROM users U ' +
                'INNER JOIN roles R ON R.id = U.role ' +
                'WHERE U.login = $1',
                [userRecord.login]
            )
            res.cookie('APP_SESSION', aes.encryptText(userRecord.login, cryptoKey), {
                httpOnly: true
            })
            response = {
                success: true,
                userInfo: {
                    id: result.rows[0].id,
                    login: result.rows[0].login,
                    role: result.rows[0].role
                }
            }
        } else {
            response = { success: false }
        }
        res.json(response)
    }
    async logout(req, res) {
        res.clearCookie('APP_SESSION')
        res.json({ success: true })
    }
}

module.exports = new AuthController()