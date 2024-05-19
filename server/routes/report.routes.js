const Router = require('express')
const router = new Router()
const reportController = require('../controller/report.controller')

router.post('/report', reportController.createReport)
router.get('/reports', reportController.getReports)
router.get('/report/:id', reportController.getOneReport)
router.delete('/report/:id', reportController.deleteReport)

module.exports = router