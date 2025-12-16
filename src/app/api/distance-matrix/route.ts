import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { originZipCode, destinations } = await request.json();

    if (!originZipCode || !destinations || !Array.isArray(destinations)) {
      return NextResponse.json(
        { error: 'Invalid request parameters' },
        { status: 400 }
      );
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Maps API key not configured' },
        { status: 500 }
      );
    }

    // Build destinations string: "lat1,lng1|lat2,lng2|..."
    const destinationsStr = destinations
      .map((loc: { latitude: number; longitude: number }) => `${loc.latitude},${loc.longitude}`)
      .join('|');

    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
    url.searchParams.append('origins', originZipCode);
    url.searchParams.append('destinations', destinationsStr);
    url.searchParams.append('units', 'imperial');
    url.searchParams.append('key', apiKey);

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      console.error('Distance Matrix API error:', response.statusText);
      return NextResponse.json(
        { error: 'Distance Matrix API error' },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Distance Matrix API status:', data.status);
      return NextResponse.json(
        { error: `API status: ${data.status}` },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in distance-matrix API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
