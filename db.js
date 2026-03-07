const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error("FATAL ERROR: DATABASE_URL is not defined in environment variables.");
}

const connectionString = process.env.DATABASE_URL;
// Supabase requires SSL. Use SSL unless connecting to localhost.
const isLocal = connectionString && connectionString.includes('localhost');

const pool = new Pool({
  connectionString: connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};