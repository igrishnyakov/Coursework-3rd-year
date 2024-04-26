const Router = require('express')
const router = new Router()
const authController = require('../controller/auth.controller')

router.post('/login', authController.login)
router.post('/register', authController.register)
router.get('/logout', authController.logout)
router.get('/checkSession', authController.checkSession)

module.exports = router