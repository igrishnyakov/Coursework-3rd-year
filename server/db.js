const Pool = require('pg').Pool
const pool = new Pool({
    user: 'postgres',
    password: '2536',
    host: 'localhost',
    port: 5432,
    database: 'react'
})

module.exports = pool