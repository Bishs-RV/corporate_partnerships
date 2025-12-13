import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

interface Location {
  cmf: number;
  location: string;
  storename: string;
}

interface UnitClass {
  class_id: number;
  class: string;
  class_description: string | null;
}

export async function GET() {
  try {
    const pool = getPool();

    // Fetch locations and unit classes in parallel
    const [locationsResult, classesResult] = await Promise.all([
      // Get locations from location_detail table
      pool.query<Location>(`
        SELECT
          cmf::INTEGER,
          location,
          CASE
            WHEN storename = 'RVFix' THEN 'Corp'
            ELSE storename
          END AS storename
        FROM location_detail
        WHERE location NOT IN('GMI', 'POC', 'COR')
        ORDER BY location ASC
      `),
      
      // Get unit classes from unit.class table
      pool.query<UnitClass>(`
        SELECT
          class_id,
          class,
          class_description
        FROM unit.class
        ORDER BY class ASC
      `),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        locations: locationsResult.rows,
        unitClasses: classesResult.rows,
      },
    });

  } catch (error) {
    console.error('Error fetching initialization data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch initialization data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
