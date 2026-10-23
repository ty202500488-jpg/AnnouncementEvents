const Pool = require('pg').Pool;

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'announcement_events',
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT || 5432),
    connectionTimeoutMillis: 5000
});

module.exports = pool;