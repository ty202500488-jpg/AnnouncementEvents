const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'announcement_events',
    password: process.env.DB_PASSWORD || '',
    port: Number(process.env.DB_PORT || 5432),
    connectionTimeoutMillis: 5000
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ DATABASE CONNECTION FAILED:', err.message);
        console.error('💡 TIP: Verify DB_USER, DB_PASSWORD, DB_NAME, and DB_PORT in server/.env');
    } else {
        console.log('✅ DATABASE CONNECTED SUCCESSFULLY at:', res.rows[0].now);
    }
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle database client:', err.message);
});

module.exports = pool;
