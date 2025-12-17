'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

/// <reference types="@types/google.maps" />

interface Location {
  cmf: number;
  location: string;
  storename: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface LocationsMapProps {
  apiKey: string;
}

export default function LocationsMap({ apiKey }: LocationsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);

  // Check if Google Maps is already loaded
  useEffect(() => {
    if (typeof window !== 'undefined' && window.google && window.google.maps) {
      setIsGoogleMapsLoaded(true);
    }
  }, []);

  useEffect(() => {
    // Fetch locations
    const fetchLocations = async () => {
      try {
        const response = await fetch('/api/init');
        const result = await response.json();
        if (result.success) {
          // Filter out locations without coordinates
          const validLocations = result.data.locations.filter(
            (loc: Location) => loc.latitude && loc.longitude
          );
          setLocations(validLocations);
        } else {
          setError('Failed to load locations');
        }
      } catch (err) {
        setError('Error fetching locations');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLocations();
  }, []);

  useEffect(() => {
    if (!mapRef.current || locations.length === 0 || !isGoogleMapsLoaded) return;

    // Calculate center point (roughly center of US)
    const centerLat = locations.reduce((sum, loc) => sum + (loc.latitude || 0), 0) / locations.length;
    const centerLng = locations.reduce((sum, loc) => sum + (loc.longitude || 0), 0) / locations.length;

    // Initialize map
    const map = new google.maps.Map(mapRef.current, {
      center: { lat: centerLat, lng: centerLng },
      zoom: 4,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
      ],
    });

    // Custom pin icon (styled to match brand)
    const customIcon = {
      path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
      fillColor: '#dc2626', // Red-600
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
      scale: 1.8,
      anchor: new google.maps.Point(12, 22),
    };

    // Add markers for each location
    locations.forEach((location) => {
      if (location.latitude && location.longitude) {
        const marker = new google.maps.Marker({
          position: { lat: location.latitude, lng: location.longitude },
          map: map,
          title: location.storename,
          icon: customIcon,
        });

        // Build info window content with all available details
        let infoContent = `
          <div style="padding: 12px; min-width: 200px; font-family: system-ui, -apple-system, sans-serif;">
            <h3 style="font-weight: 700; margin: 0 0 8px 0; color: #111827; font-size: 16px;">${location.storename}</h3>
        `;

        // Add address if available
        if (location.address) {
          infoContent += `<p style="color: #374151; font-size: 14px; margin: 4px 0; line-height: 1.4;">${location.address}</p>`;
        }

        // Add city, state, zip on one line if available
        const cityStateZip = [
          location.city,
          location.state,
          location.zipcode
        ].filter(Boolean).join(', ');
        
        if (cityStateZip) {
          infoContent += `<p style="color: #374151; font-size: 14px; margin: 4px 0; line-height: 1.4;">${cityStateZip}</p>`;
        }

        // Add location code
        infoContent += `<p style="color: #6b7280; font-size: 12px; margin: 8px 0 0 0; font-style: italic;">Location: ${location.location}</p>`;
        infoContent += '</div>';

        const infoWindow = new google.maps.InfoWindow({
          content: infoContent,
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });
      }
    });
  }, [locations, isGoogleMapsLoaded]);

  if (isLoading) {
    return (
      <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-gray-600">Loading map...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`}
        onLoad={() => setIsGoogleMapsLoaded(true)}
        strategy="afterInteractive"
      />
      <div ref={mapRef} className="w-full h-96 rounded-lg shadow-lg border border-gray-300" />
    </>
  );
}
