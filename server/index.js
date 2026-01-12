const express = require('express')
const cookieParser = require('cookie-parser')
const newsRouter = require('./routes/news.routes')
const authRouter = require('./routes/auth.routes')
const reportRouter = require('./routes/report.routes')
const eventRouter = require('./routes/event.routes')
const applicationRouter = require('./routes/application.routes')
const profileRouter = require('./routes/profile.routes')
const adminRouter = require('./routes/admin.routes');
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
app.use('/api', [newsRouter, authRouter, reportRouter, eventRouter, applicationRouter, profileRouter])
app.use('/api/admin', adminRouter);

app.listen(PORT, () => console.log('server started on port ' + PORT))