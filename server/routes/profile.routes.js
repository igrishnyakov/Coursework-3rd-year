const express = require('express')
const router = express.Router()
const profileController = require('../controller/profile.controller')

router.get('/volunteer/:id', profileController.getVolunteer)
router.post('/volunteer/:id/update', profileController.updateVolunteer)
router.get('/organizer/:id', profileController.getOrganizer)
router.post('/organizer/:id/update', profileController.updateOrganizer)
router.post('/user/:id/updatePassword', profileController.updatePassword)
router.get('/skills', profileController.getSkills);

module.exports = router