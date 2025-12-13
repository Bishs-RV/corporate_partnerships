require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function exploreCMFDatabase() {
  const pool = new Pool({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('=== EXPLORING CMF DATABASE STRUCTURE ===\n');
    
    // 1. Find tables with 'cmf' in the name
    console.log('1. Tables containing "cmf" in their name:');
    const cmfTables = await pool.query(`
      SELECT table_schema, table_name, table_type
      FROM information_schema.tables
      WHERE table_name ILIKE '%cmf%'
        AND table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name;
    `);
    console.log(cmfTables.rows);
    console.log('');
    
    // 2. Check location_detail columns (we know cmf is there)
    console.log('2. All columns in location_detail table:');
    const locationCols = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'location_detail'
      ORDER BY ordinal_position;
    `);
    locationCols.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''}`);
    });
    console.log('');
    
    // 3. Sample data from location_detail to see what's available
    console.log('3. Sample location_detail data (showing all columns):');
    const sampleLocation = await pool.query(`
      SELECT *
      FROM location_detail
      WHERE location NOT IN('GMI', 'POC', 'COR')
      LIMIT 1;
    `);
    if (sampleLocation.rows.length > 0) {
      console.log(JSON.stringify(sampleLocation.rows[0], null, 2));
    }
    console.log('');
    
    // 4. Check if there's a CMF table or view
    console.log('4. Checking for cmf-related tables/views:');
    const cmfRelated = await pool.query(`
      SELECT schemaname, tablename, 'table' as type
      FROM pg_tables
      WHERE tablename ILIKE '%cmf%'
      UNION
      SELECT schemaname, viewname as tablename, 'view' as type
      FROM pg_views
      WHERE viewname ILIKE '%cmf%'
      ORDER BY tablename;
    `);
    console.log(cmfRelated.rows);
    console.log('');
    
    // 5. Find tables with zip/address columns
    console.log('5. Tables with zip/address/postal columns:');
    const zipTables = await pool.query(`
      SELECT DISTINCT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          column_name ILIKE '%zip%' 
          OR column_name ILIKE '%postal%'
          OR column_name ILIKE '%address%'
        )
      ORDER BY table_name, column_name;
    `);
    console.log(zipTables.rows);
    console.log('');
    
    // 6. Check foreign key relationships from inventory to other tables
    console.log('6. Foreign key relationships involving cmf_id:');
    const fkRelations = await pool.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND (kcu.column_name ILIKE '%cmf%' OR ccu.column_name ILIKE '%cmf%')
      ORDER BY tc.table_name;
    `);
    console.log(fkRelations.rows);
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Details:', error);
  } finally {
    await pool.end();
  }
}

exploreCMFDatabase();
