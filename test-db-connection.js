const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

console.log('🔍 Testing Database Connection');
console.log('================================');
console.log(`DATABASE_URL: ${DATABASE_URL ? 'Present' : 'MISSING'}`);

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set in .env file');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('error', (err) => {
  console.error('❌ Pool Error:', err.message);
});

(async () => {
  try {
    console.log('Attempting to connect...');
    const client = await pool.connect();
    console.log('✅ Successfully connected to database!');
    
    // Test a simple query
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database is responsive');
    console.log(`Current DB Time: ${result.rows[0].now}`);
    
    client.release();
    await pool.end();
    console.log('✅ Connection closed cleanly');
  } catch (err) {
    console.error('❌ Connection failed!');
    console.error(`Error Code: ${err.code}`);
    console.error(`Error Message: ${err.message}`);
    
    if (err.code === 'ENOTFOUND') {
      console.error('\n⚠️  DNS Resolution Error:');
      console.error('The hostname cannot be resolved. This usually means:');
      console.error('1. Your Supabase project is PAUSED - go to https://app.supabase.com and Resume it');
      console.error('2. Your internet connection is down');
      console.error('3. Your DNS is not working properly');
    }
    
    process.exit(1);
  }
})();
