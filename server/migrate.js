const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

async function runMigration() {
    const dbUser = process.env.DB_USER || 'postgres';
    const dbPassword = process.env.DB_PASSWORD || '';
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = Number(process.env.DB_PORT || 5432);
    const dbName = process.env.DB_NAME || 'announcement_events';

    // 1. Connect to default 'postgres' database to ensure target database exists
    const adminClient = new Client({
        user: dbUser,
        password: dbPassword,
        host: dbHost,
        port: dbPort,
        database: 'postgres'
    });

    await adminClient.connect();
    const checkRes = await adminClient.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [dbName]
    );

    if (checkRes.rowCount === 0) {
        await adminClient.query(`CREATE DATABASE "${dbName}"`);
        console.log(`✅ Created database "${dbName}"`);
    } else {
        console.log(`ℹ️ Database "${dbName}" already exists`);
    }
    await adminClient.end();

    // 2. Connect to target database and execute database.sql
    const targetClient = new Client({
        user: dbUser,
        password: dbPassword,
        host: dbHost,
        port: dbPort,
        database: dbName
    });

    await targetClient.connect();
    const sqlPath = path.join(__dirname, 'database.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await targetClient.query(sql);

    const tablesRes = await targetClient.query(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
         ORDER BY table_name`
    );

    console.log(`✅ Executed database.sql successfully! Total tables (${tablesRes.rowCount}):`);
    console.log('   ' + tablesRes.rows.map(r => r.table_name).join(', '));

    const countsRes = await targetClient.query(
        `SELECT
            (SELECT COUNT(*) FROM roles) AS roles_count,
            (SELECT COUNT(*) FROM departments) AS departments_count,
            (SELECT COUNT(*) FROM programs) AS programs_count,
            (SELECT COUNT(*) FROM organizations) AS organizations_count,
            (SELECT COUNT(*) FROM post_categories) AS categories_count,
            (SELECT COUNT(*) FROM academic_years) AS academic_years_count`
    );
    console.log('✅ Seeded counts:', countsRes.rows[0]);

    await targetClient.end();
}

runMigration().catch((err) => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
});
