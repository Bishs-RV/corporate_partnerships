import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET() {
  try {
    const pool = getPool();
    const results: any = {};

    // 1. Find tables with 'cmf' in the name
    const cmfTables = await pool.query(`
      SELECT table_schema, table_name, table_type
      FROM information_schema.tables
      WHERE table_name ILIKE '%cmf%'
        AND table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name;
    `);
    results.cmfTables = cmfTables.rows;

    // 2. All columns in location_detail
    const locationCols = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'location_detail'
      ORDER BY ordinal_position;
    `);
    results.locationDetailColumns = locationCols.rows;

    // 3. Sample data from location_detail
    const sampleLocation = await pool.query(`
      SELECT *
      FROM location_detail
      WHERE location NOT IN('GMI', 'POC', 'COR')
      LIMIT 1;
    `);
    results.sampleLocationData = sampleLocation.rows[0] || null;

    // 4. Tables with zip/address/postal columns
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
    results.tablesWithAddressColumns = zipTables.rows;

    // 5. Foreign key relationships involving cmf
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
    results.cmfForeignKeys = fkRelations.rows;

    // 6. Get sample inventory row with cmf_id to understand the relationship
    const sampleInventory = await pool.query(`
      SELECT cmf_id, location, stocknumber
      FROM unit.get_inventory(
        NULL, ARRAY[8]::INTEGER[], NULL, NULL, NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL, FALSE, FALSE, FALSE, TRUE
      )
      WHERE cmf_id IS NOT NULL
      LIMIT 1;
    `);
    results.sampleInventoryCMF = sampleInventory.rows[0] || null;

    return NextResponse.json({
      success: true,
      data: results,
    });

  } catch (error) {
    console.error('Error exploring CMF database:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to explore database',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
