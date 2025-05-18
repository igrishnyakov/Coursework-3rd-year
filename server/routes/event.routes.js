const Router = require('express')
const router = new Router()
const eventController = require('../controller/event.controller')

router.post('/event', eventController.createEvent)
router.get('/events', eventController.getEvents)
router.get('/event/:id', eventController.getOneEvent)
router.delete('/event/:id', eventController.deleteEvent)
router.get('/categories', eventController.getCategories)

router.get('/event/:id/volunteers', eventController.getEventVolunteers)
router.get('/volunteers', eventController.getAllVolunteers)
router.post('/event/:id/add-volunteer', eventController.addVolunteerToEvent)
router.post('/event/:id/remove-volunteer', eventController.removeVolunteerFromEvent)

router.post('/event/:id/apply', eventController.applyForEvent)
router.post('/event/:id/cancel-application', eventController.cancelApplication)
router.get('/event/:id/participation-status/:volunteerId', eventController.getVolunteerParticipationStatus)

router.get('/event/:id/report', eventController.generatePdfReport)

router.get('/event/:id/recommended', eventController.getRecommendedVols)
router.post('/event/:id/assign-recommended', eventController.assignRecommended)

module.exports = router