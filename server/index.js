const express = require('express')
const cookieParser = require('cookie-parser')
const itemRouter = require('./routes/item.routes')
const authRouter = require('./routes/auth.routes')
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
app.use('/api', [itemRouter, authRouter])

app.listen(PORT, () => console.log('server started on port ' + PORT))