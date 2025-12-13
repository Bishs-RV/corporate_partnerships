// Test PostgreSQL connection directly
const { Pool } = require('pg');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function testConnection() {
  console.log('Testing PostgreSQL Connection...\n');
  
  // Get password and strip quotes if present
  let password = process.env.DATABASE_PASSWORD || '';
  if ((password.startsWith('"') && password.endsWith('"')) || 
      (password.startsWith("'") && password.endsWith("'"))) {
    password = password.slice(1, -1);
  }
  
  console.log('Configuration:');
  console.log('  Host:', process.env.DATABASE_HOST);
  console.log('  Port:', process.env.DATABASE_PORT);
  console.log('  Database:', process.env.DATABASE_NAME);
  console.log('  User:', process.env.DATABASE_USER);
  console.log('  Password length:', password.length);
  console.log('  Password starts with:', password.charAt(0));
  console.log('  Password ends with:', password.charAt(password.length - 1));
  console.log();

  const pool = new Pool({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: password,
    connectionTimeoutMillis: 5000,
  });

  try {
    console.log('Attempting to connect...');
    const client = await pool.connect();
    console.log('✓ Connection successful!');
    
    // Test a simple query
    const result = await client.query('SELECT current_database(), current_user, version()');
    console.log('\nConnection Info:');
    console.log('  Database:', result.rows[0].current_database);
    console.log('  User:', result.rows[0].current_user);
    console.log('  PostgreSQL Version:', result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1]);
    
    client.release();
    
    // Test the stored procedure exists
    console.log('\nTesting stored procedure access...');
    const sprocCheck = await pool.query(`
      SELECT proname, oid::regprocedure 
      FROM pg_proc 
      WHERE pronamespace = 'unit'::regnamespace 
      AND proname = 'get_inventory'
    `);
    
    if (sprocCheck.rows.length > 0) {
      console.log('✓ unit.get_inventory() stored procedure found');
    } else {
      console.log('⚠ Warning: unit.get_inventory() stored procedure not found');
    }
    
    await pool.end();
    console.log('\n✓ All tests passed!');
    process.exit(0);
    
  } catch (error) {
    console.error('✗ Connection failed:');
    console.error('Error:', error.message);
    
    if (error.code === '28P01') {
      console.error('\nAuthentication Error - Possible issues:');
      console.error('  1. Password is incorrect');
      console.error('  2. Password contains special characters that need escaping');
      console.error('  3. User does not have access from this IP address');
      console.error('  4. Password in pgAdmin might be saved/cached differently');
      console.error('\nTry:');
      console.error('  - Verify password in pgAdmin settings (not cached)');
      console.error('  - Check if special characters need URL encoding');
      console.error('  - Confirm user "cjohnson" has remote access permissions');
    }
    
    await pool.end();
    process.exit(1);
  }
}

testConnection();
