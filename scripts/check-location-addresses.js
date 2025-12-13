require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function checkLocationAddresses() {
  const pool = new Pool({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Checking location_detail table structure...\n');
    
    // Check columns in location_detail
    const columnsResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'location_detail'
      ORDER BY ordinal_position;
    `);
    
    console.log('Columns in location_detail table:');
    columnsResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    console.log('\nSample location data with addresses:');
    
    // Get sample location data
    const locationsResult = await pool.query(`
      SELECT 
        cmf,
        location,
        storename,
        address1,
        address2,
        city,
        state,
        zipcode,
        country
      FROM location_detail
      WHERE location NOT IN('GMI', 'POC', 'COR')
      LIMIT 5;
    `);
    
    console.log(JSON.stringify(locationsResult.rows, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkLocationAddresses();
