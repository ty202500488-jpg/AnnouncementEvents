const Pool = require('pg').Pool;

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'announcement_events',
    password: '983025',
    port: 5432
});

module.exports = pool;