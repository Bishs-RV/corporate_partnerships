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

// Load cache from localStorage on module initialization
if (typeof window !== 'undefined') {
  try {
    const stored = localStorage.getItem('zipCoordinatesCache');
    if (stored) {
      const parsed = JSON.parse(stored);
      Object.entries(parsed).forEach(([zip, coords]) => {
        zipCodeCache.set(zip, coords as Coordinates);
      });
    }
  } catch (error) {
    console.error('Error loading zip coordinate cache:', error);
  }
}

export function getCachedCoordinates(zipCode: string): Coordinates | null {
  return zipCodeCache.get(zipCode) || null;
}

export function cacheCoordinates(zipCode: string, coordinates: Coordinates): void {
  zipCodeCache.set(zipCode, coordinates);
  
  // Persist to localStorage
  if (typeof window !== 'undefined') {
    try {
      const cacheObject = Object.fromEntries(zipCodeCache);
      localStorage.setItem('zipCoordinatesCache', JSON.stringify(cacheObject));
    } catch (error) {
      console.error('Error saving zip coordinate cache:', error);
    }
  }
}

// Google Maps Distance Matrix API types
export interface LocationWithCoordinates {
  locationId: string;
  latitude: number;
  longitude: number;
}

export interface DrivingDistanceResult {
  locationId: string;
  distanceInMiles: number;
  durationInMinutes: number;
}

// Session storage cache for distance matrix results
const DISTANCE_CACHE_KEY = 'distanceMatrixCache';

interface DistanceCacheEntry {
  zipCode: string;
  timestamp: number;
  results: Record<string, number>; // locationId -> distance in miles
}

function getDistanceCache(zipCode: string): Record<string, number> | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = sessionStorage.getItem(DISTANCE_CACHE_KEY);
    if (!stored) return null;
    
    const cache: DistanceCacheEntry = JSON.parse(stored);
    
    // Check if cache is for the same zip code and less than 1 hour old
    if (cache.zipCode === zipCode && Date.now() - cache.timestamp < 3600000) {
      return cache.results;
    }
    
    return null;
  } catch (error) {
    console.error('Error reading distance cache:', error);
    return null;
  }
}

function setDistanceCache(zipCode: string, results: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  
  try {
    const cache: DistanceCacheEntry = {
      zipCode,
      timestamp: Date.now(),
      results
    };
    sessionStorage.setItem(DISTANCE_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Error saving distance cache:', error);
  }
}

/**
 * Calculate driving distances from origin zip code to multiple destination locations
 * using Google Maps Distance Matrix API in a single batch call
 */
export async function calculateDrivingDistances(
  originZipCode: string,
  destinations: LocationWithCoordinates[]
): Promise<Record<string, number>> {
  if (destinations.length === 0) {
    return {};
  }

  try {
    // Call our API route which proxies to Google Maps
    const response = await fetch('/api/distance-matrix', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        originZipCode,
        destinations: destinations.map(loc => ({
          latitude: loc.latitude,
          longitude: loc.longitude
        }))
      })
    });
    
    if (!response.ok) {
      console.error('Distance Matrix API error:', response.statusText);
      return {};
    }

    const result = await response.json();

    if (!result.success) {
      console.error('Distance Matrix API error:', result.error);
      return {};
    }

    const data = result.data;

    // Parse results
    const results: Record<string, number> = {};
    
    if (data.rows && data.rows[0] && data.rows[0].elements) {
      data.rows[0].elements.forEach((element: any, index: number) => {
        if (element.status === 'OK' && element.distance) {
          const locationId = destinations[index].locationId;
          // Convert meters to miles and round
          const distanceInMiles = Math.round(element.distance.value * 0.000621371);
          results[locationId] = distanceInMiles;
        }
      });
    }

    return results;
  } catch (error) {
    console.error('Error calculating driving distances:', error);
    return {};
  }
}
