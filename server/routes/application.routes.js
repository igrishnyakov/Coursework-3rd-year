const Router = require('express')
const router = new Router()
const applicationController = require('../controller/application.controller')

router.get('/applications', applicationController.getApplications)
router.post('/application/:id/status', applicationController.changeApplicationStatus)

router.get('/volunteer/:volunteerId/applications', applicationController.getVolunteerApplications)
router.post('/application/:id/cancel', applicationController.cancelApplication)

module.exports = router