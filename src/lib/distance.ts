// Haversine formula to calculate distance between two points on Earth
// Returns distance in miles

interface Coordinates {
  latitude: number;
  longitude: number;
}

// Calculate distance between two coordinates using Haversine formula
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance); // Return rounded miles
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Convert zip code to coordinates using public API
// We'll use a free geocoding service
export async function getCoordinatesFromZip(zipCode: string): Promise<Coordinates | null> {
  try {
    // Using zipcodebase.com free tier or similar service
    // For US zip codes, we can use a simple approximation or free service
    
    // Option 1: Use OpenStreetMap Nominatim (free, but rate limited)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${zipCode}&country=US&format=json&limit=1`,
      {
        headers: {
          'User-Agent': 'Kiewit-RV-Portal/1.0'
        }
      }
    );
    
    if (!response.ok) {
      console.error('Geocoding API error:', response.statusText);
      return null;
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon)
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error geocoding zip code:', error);
    return null;
  }
}

// Store zip coordinates in local cache to avoid repeated API calls
const zipCodeCache = new Map<string, Coordinates>();

export function getCachedCoordinates(zipCode: string): Coordinates | null {
  return zipCodeCache.get(zipCode) || null;
}

export function cacheCoordinates(zipCode: string, coordinates: Coordinates): void {
  zipCodeCache.set(zipCode, coordinates);
}
