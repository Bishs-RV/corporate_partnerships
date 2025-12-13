import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

// Extended location interface with address fields
interface LocationWithAddress {
  cmf: number;
  location: string;
  storename: string;
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  country: string | null;
}

export async function GET() {
  try {
    const pool = getPool();

    // Fetch locations with full address information
    const result = await pool.query<LocationWithAddress>(`
      SELECT
        cmf::INTEGER,
        location,
        CASE
          WHEN storename = 'RVFix' THEN 'Corp'
          ELSE storename
        END AS storename,
        address1,
        address2,
        city,
        state,
        zipcode,
        country
      FROM location_detail
      WHERE location NOT IN('GMI', 'POC', 'COR')
      ORDER BY location ASC
    `);

    return NextResponse.json({
      success: true,
      data: result.rows,
    });

  } catch (error) {
    console.error('Error fetching location addresses:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch location addresses',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
