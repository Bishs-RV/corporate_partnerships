import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { DatabaseInventoryRow, transformInventoryToRV } from '@/types/inventory';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pool = getPool();
    
    // Get the Kiewit location CMF ID from environment (default filter)
    const defaultLocationCmfId = parseInt(process.env.KIEWIT_LOCATION_CMF_ID || '76179597');
    
    // Parse query parameters for filters
    const locationIdsParam = searchParams.get('locationIds');
    const classNamesParam = searchParams.get('classNames'); // RV types (class names)
    
    // Build location filter - use URL param if provided, otherwise use default
    const locationIds = locationIdsParam 
      ? locationIdsParam.split(',').map(Number)
      : [defaultLocationCmfId];
    
    // Build class name filter (RV types like 'DT', 'FWTH', etc.)
    const classNames = classNamesParam 
      ? classNamesParam.split(',')
      : null;
    
    // Build query parameters array
    const queryParams: any[] = [locationIds];
    
    let classFilter = '';
    if (classNames) {
      classFilter = `AND class = ANY($2::VARCHAR[])`;
      queryParams.push(classNames);
    }
    
    // Call the stored procedure with filters
    // Note: The stored procedure parameters are positional
    // Price filtering is done client-side for better performance
    const query = `
      SELECT * FROM unit.get_inventory(
        NULL,   -- inventory_id_param
        ARRAY[8]::INTEGER[],   -- status_param (8 = in-inventory)
        $1::INTEGER[],   -- location_param
        NULL,   -- year_param
        NULL,   -- rep_param
        NULL,   -- manufacturer_param
        NULL,   -- make_param
        NULL,   -- sub_make_param
        NULL,   -- model_param
        NULL,   -- production_zone_param
        NULL,   -- vin_param
        NULL,   -- motor_vin_param
        NULL,   -- stocknumber_param
        FALSE,  -- include_transport_param
        FALSE,  -- include_created_by
        FALSE,  -- include_retail_customer
        TRUE    -- include_characteristic_data (for specs like sleep_count)
      )
      WHERE condition = 'New'
      ${classFilter}
      ORDER BY year DESC, manufacturer, make, model;
    `;
    const result = await pool.query<DatabaseInventoryRow>(query, queryParams);
    
    // Transform the database rows to UI-friendly RV format
    const inventory = result.rows.map(transformInventoryToRV);
    
    return NextResponse.json({
      success: true,
      count: inventory.length,
      data: inventory,
    });
    
  } catch (error) {
    console.error('Error fetching inventory:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch inventory',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
