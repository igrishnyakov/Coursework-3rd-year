const db = require('../db')
const pidCrypt = require('pidcrypt')
require('pidcrypt/aes_cbc')

const aes = new pidCrypt.AES.CBC()
const cryptoKey = 'это_ключик_для_шифрования))'

async function checkUserRole(clientRequest) {
    const sessionCookie = clientRequest.cookies['APP_SESSION']
    const userName = aes.decryptText(sessionCookie, cryptoKey)
    const result = await db.query(
        'SELECT R.name as role FROM users U INNER JOIN roles R ON R.id = U.role WHERE U.login = $1',
        [userName]
    )
    return result.rows[0].role
}

module.exports = { checkUserRole }