const Router = require('express')
const router = new Router()
const newsController = require('../controller/news.controller')

router.post('/news', newsController.createNews)
router.get('/news', newsController.getNews)
router.get('/news/:id', newsController.getOneNews)
router.delete('/news/:id', newsController.deleteNews)

module.exports = router