const express = require('express')
const cookieParser = require('cookie-parser')
const newsRouter = require('./routes/news.routes')
const authRouter = require('./routes/auth.routes')
const reportRouter = require('./routes/report.routes')
const cors = require('cors')
const PORT = 3001
const app = express()

const corsConfig = {
    credentials: true,
    origin: true
}

app.use(express.json())
app.use(cookieParser())
app.use(cors(corsConfig))
app.use('/api', [newsRouter, authRouter, reportRouter])

app.listen(PORT, () => console.log('server started on port ' + PORT))