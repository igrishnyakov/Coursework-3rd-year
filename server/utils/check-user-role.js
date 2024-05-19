const db = require('../db')
const pidCrypt = require('pidcrypt')
require('pidcrypt/aes_cbc')

const aes = new pidCrypt.AES.CBC()
const cryptoKey = 'это_ключик_для_шифрования))'

async function checkUserRole(clientRequest) {
    const sessionCookie = clientRequest.cookies['APP_SESSION']
    const userEmail = aes.decryptText(sessionCookie, cryptoKey)
    const result = await db.query(
        'SELECT * FROM organizer O WHERE O.email = $1',
        [userEmail]
    )
    if (result.rows[0])
        return 'org'
    else
        return 'vol'
}

module.exports = { checkUserRole }