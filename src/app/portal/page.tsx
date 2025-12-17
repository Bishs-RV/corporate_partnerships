'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { RV, GroupedRV, groupRVsByModel } from '@/types/inventory';
import RVCard from '@/components/RVCard';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { getCoordinatesFromZip, calculateDistance, getCachedCoordinates, cacheCoordinates, calculateDrivingDistances, LocationWithCoordinates } from '@/lib/distance';
import { getAllImages, getDetailUrl } from '@/lib/rvImages';

export default function PortalPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [inventory, setInventory] = useState<RV[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  
  // Location and class options from database
  const [locations, setLocations] = useState<Array<{ cmf: number; location: string; storename: string; zipcode: string | null; latitude: number | null; longitude: number | null }>>([]);
  const [unitClasses, setUnitClasses] = useState<Array<{ class_id: number; class: string; class_description: string | null }>>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  
  // User location state for distance calculations
  const [userZip, setUserZip] = useState<string>('');
  const [isGeocodingZip, setIsGeocodingZip] = useState(false);
  const [locationDistances, setLocationDistances] = useState<Map<number, number>>(new Map());
  const [zipDebounceTimer, setZipDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Price filter state
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(100000);
  const [priceMin, setPriceMin] = useState<string>('');
  const [priceMax, setPriceMax] = useState<string>('');
  
  // Monthly payment filter state (will be dynamically set based on max price)
  const [minMonthlyPayment, setMinMonthlyPayment] = useState<number>(0);
  const [maxMonthlyPayment, setMaxMonthlyPayment] = useState<number>(10000); // High initial value, will be clamped by dynamic limit
  const [monthlyPaymentMin, setMonthlyPaymentMin] = useState<string>('');
  const [monthlyPaymentMax, setMonthlyPaymentMax] = useState<string>('');
  
  // RV Type dropdown state
  const [isRvTypeDropdownOpen, setIsRvTypeDropdownOpen] = useState(false);
  
  // Sleeps filter state
  const [minSleeps, setMinSleeps] = useState<number>(0);
  
  // Distance filter state
  const [maxDistance, setMaxDistance] = useState<number>(10000); // Default to no limit (10000 miles)
  
  // Manufacturer filter state - default to BRINKLEY RV
  const [selectedManufacturers, setSelectedManufacturers] = useState<string[]>(['BRINKLEY RV']);
  
  // Sort state
  const [sortBy, setSortBy] = useState<'price-asc' | 'price-desc' | 'discount-desc' | 'distance-asc'>('price-asc');
  
  // Mobile filter menu state
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  
  // Manufacturer dropdown state
  const [isManufacturerDropdownOpen, setIsManufacturerDropdownOpen] = useState(false);

  // Helper functions for pricing calculations
  const KIEWIT_DISCOUNT_PERCENT = 0.15; // 15% discount
  const calculateDiscountedPrice = (price: number) => Math.round(price * (1 - KIEWIT_DISCOUNT_PERCENT));
  
  // Calculate monthly payment (0% APR for 120 months)
  const calculateMonthlyPayment = (price: number): number => {
    const discountedPrice = calculateDiscountedPrice(price);
    return Math.round(discountedPrice / 120); // 0% APR, so just divide by months
  };

  // Calculate dynamic max monthly payment based on current max price or highest inventory price
  const maxMonthlyPaymentLimit = useMemo(() => {
    const highestInventoryPrice = inventory.length > 0 ? Math.max(...inventory.map(rv => rv.price || 0)) : 200000;
    const effectiveMaxPrice = Math.min(maxPrice, highestInventoryPrice);
    return calculateMonthlyPayment(effectiveMaxPrice);
  }, [inventory, maxPrice]);

  // Pre-filter inventory once for valid images/URLs (expensive operation)
  const validInventory = useMemo(() => {
    return inventory.filter(rv => {
      if (!rv.price || rv.price <= 0) return false;
      if (!rv.stock) return false;
      const hasImages = getAllImages(rv.stock).length > 0;
      const hasDetailUrl = getDetailUrl(rv.stock) !== undefined;
      return hasImages && hasDetailUrl;
    });
  }, [inventory]);

  // Client-side filtering (type, price, sleeps, manufacturer, distance, and monthly payment)
  const filteredInventory = useMemo(() => {
    return validInventory.filter(rv => {
      // Filter by manufacturer
      if (selectedManufacturers.length > 0 && !selectedManufacturers.includes(rv.manufacturer)) return false;
      // Filter by RV type
      if (selectedTypes.length > 0 && !selectedTypes.includes(rv.type)) return false;
      // Filter by price
      if (minPrice > 0 && rv.price < minPrice) return false;
      if (maxPrice < 100000 && rv.price > maxPrice) return false; // Only filter if not at max
      // Filter by monthly payment
      const monthlyPayment = calculateMonthlyPayment(rv.price);
      if (minMonthlyPayment > 0 && monthlyPayment < minMonthlyPayment) return false;
      if (maxMonthlyPayment < maxMonthlyPaymentLimit && monthlyPayment > maxMonthlyPayment) return false; // Only filter if not at max
      // Filter by sleeps
      if (minSleeps > 0 && rv.sleeps < minSleeps) return false;
      // Filter by distance (if user has calculated distances)
      if (locationDistances.size > 0 && maxDistance < 10000 && rv.cmfId) {
        const distance = locationDistances.get(rv.cmfId);
        if (distance !== undefined && distance > maxDistance) return false;
      }
      return true;
    });
  }, [validInventory, selectedManufacturers, selectedTypes, minPrice, maxPrice, minMonthlyPayment, maxMonthlyPayment, minSleeps, locationDistances, maxDistance]);

  // Memoize benefits banner calculation
  const benefitsSavingsText = useMemo(() => {
    if (filteredInventory.length === 0) return null;
    // Calculate max total savings (price discount + financing savings)
    const maxSavings = Math.max(...filteredInventory.map(rv => {
      const discountedPrice = calculateDiscountedPrice(rv.price);
      const priceSavings = rv.price - discountedPrice;
      // Calculate financing savings
      const typicalAPR = 0.0899;
      const financingMonths = 120;
      const monthlyRate = typicalAPR / 12;
      const typicalMonthlyPayment = discountedPrice * (monthlyRate * Math.pow(1 + monthlyRate, financingMonths)) / (Math.pow(1 + monthlyRate, financingMonths) - 1);
      const kiewitTotalPaid = discountedPrice; // 0% APR
      const typicalTotalPaid = typicalMonthlyPayment * financingMonths;
      const financingSavings = typicalTotalPaid - kiewitTotalPaid;
      return Math.round(priceSavings + financingSavings);
    }));
    return <span>Save up to <strong>${maxSavings.toLocaleString()}</strong> per vehicle.</span>;
  }, [filteredInventory]);

  // Group filtered inventory by model
  const groupedInventory = useMemo(() => {
    return groupRVsByModel(filteredInventory);
  }, [filteredInventory]);

  // Fetch locations and unit classes on mount
  useEffect(() => {
    async function fetchOptions() {
      try {
        const response = await fetch('/api/init');
        const result = await response.json();
        
        if (result.success) {
          setLocations(result.data.locations);
          setUnitClasses(result.data.unitClasses);
        } else {
          console.error('Failed to load filter options:', result.error);
        }
      } catch (err) {
        console.error('Error fetching filter options:', err);
      } finally {
        setIsLoadingOptions(false);
      }
    }
    
    fetchOptions();
  }, []);

  // Fetch inventory from API with filters
  useEffect(() => {
    // Don't fetch until locations are loaded
    if (isLoadingOptions || locations.length === 0) {
      return;
    }
    
    async function fetchInventory() {
      try {
        setIsLoadingInventory(true);
        setError(null);
        
        // Build query params
        const params = new URLSearchParams();
        
        // Add location filter
        if (selectedLocation === 'all') {
          // When "All Locations" is selected, pass all location CMF IDs
          const allLocationIds = locations.map(loc => loc.cmf).join(',');
          params.append('locationIds', allLocationIds);
        } else {
          // Pass the single selected location
          params.append('locationIds', selectedLocation);
        }
        
        // Don't filter by type in API - we'll do that client-side
        // This ensures all types are available in the dropdown
        
        const url = `/api/inventory${params.toString() ? `?${params.toString()}` : ''}`;
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success) {
          setInventory(result.data);
        } else {
          setError(result.error || 'Failed to load inventory');
        }
      } catch (err) {
        setError('Network error: Unable to fetch inventory');
        console.error('Error fetching inventory:', err);
      } finally {
        setIsLoadingInventory(false);
      }
    }
    
    fetchInventory();
  }, [selectedLocation, locations, isLoadingOptions]);

  // Handle Calculate Distance button click
  const handleCalculateDistance = async () => {
    const zip = userZip.trim();
    if (zip.length !== 5) return;
    
    setIsGeocodingZip(true);
    
    try {
      // Calculate driving distances using Google Maps Distance Matrix API
      await calculateDistancesToLocations(zip);
      // Save zip code to localStorage for use on purchase page
      localStorage.setItem('userZip', zip);
    } catch (error) {
      console.error('Error calculating distances:', error);
      setLocationDistances(new Map());
    } finally {
      setIsGeocodingZip(false);
    }
  };
  
  // Handle zip code input with debouncing for auto-calculation
  const handleZipChange = (value: string) => {
    setUserZip(value);
    
    // Clear existing timer
    if (zipDebounceTimer) {
      clearTimeout(zipDebounceTimer);
    }
    
    // If we have a valid 5-digit zip, debounce the auto-calculation
    if (value.length === 5) {
      const timer = setTimeout(async () => {
        // Auto-calculate driving distances
        try {
          await calculateDistancesToLocations(value);
        } catch (error) {
          console.error('Error auto-calculating distances:', error);
        }
      }, 500); // 500ms debounce
      setZipDebounceTimer(timer);
    }
  };
  
  // Calculate driving distances to all unique locations using Google Maps Distance Matrix API
  const calculateDistancesToLocations = async (zipCode: string) => {
    // Extract unique locations from filtered inventory that have coordinates
    const uniqueLocations: LocationWithCoordinates[] = [];
    const seenLocations = new Set<number>();
    
    for (const rv of filteredInventory) {
      if (rv.cmfId && !seenLocations.has(rv.cmfId)) {
        const location = locations.find(loc => loc.cmf === rv.cmfId);
        if (location && location.latitude !== null && location.longitude !== null) {
          uniqueLocations.push({
            locationId: rv.cmfId.toString(),
            latitude: location.latitude,
            longitude: location.longitude
          });
          seenLocations.add(rv.cmfId);
        }
      }
    }
    
    if (uniqueLocations.length === 0) {
      setLocationDistances(new Map());
      return;
    }
    
    // Make batch API call to get driving distances
    const results = await calculateDrivingDistances(zipCode, uniqueLocations);
    
    // Convert results to Map<cmf, distance>
    const distances = new Map<number, number>();
    Object.entries(results).forEach(([locationId, distance]) => {
      distances.set(parseInt(locationId), distance);
    });
    
    setLocationDistances(distances);
  };

  useEffect(() => {
    // Check if user is verified
    const verified = localStorage.getItem('verified');
    const email = localStorage.getItem('userEmail');

    if (!verified || !email) {
      router.push('/');
      return;
    }

    setUserEmail(email);
    setIsLoading(false);
  }, [router]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTypes, selectedLocation, minPrice, maxPrice, minSleeps]);

  const handleLogout = () => {
    localStorage.removeItem('verified');
    localStorage.removeItem('userEmail');
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow">
          <h2 className="text-xl font-bold text-red-600 mb-4">Error Loading Inventory</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Get unique manufacturers from inventory
  const uniqueManufacturers = Array.from(new Set(inventory.map(rv => rv.manufacturer).filter(Boolean))).sort();
  
  // Log manufacturers for debugging (can be removed later)
  if (uniqueManufacturers.length > 0 && !isLoadingInventory) {
    console.log('Available manufacturers:', uniqueManufacturers);
  }
  
  // Sort grouped inventory
  const sortedInventory = [...groupedInventory].sort((a, b) => {
    if (sortBy === 'price-asc') {
      return a.price - b.price;
    } else if (sortBy === 'price-desc') {
      return b.price - a.price;
    } else if (sortBy === 'discount-desc') {
      const savingsA = a.price * KIEWIT_DISCOUNT_PERCENT;
      const savingsB = b.price * KIEWIT_DISCOUNT_PERCENT;
      return savingsB - savingsA;
    } else if (sortBy === 'distance-asc') {
      // For grouped RVs, use the closest location
      let distanceA: number | undefined;
      let distanceB: number | undefined;
      
      if (a.multipleLocations) {
        // Find closest location in the group
        const distances = a.units.map(rv => rv.cmfId ? locationDistances.get(rv.cmfId) : undefined).filter(d => d !== undefined) as number[];
        distanceA = distances.length > 0 ? Math.min(...distances) : undefined;
      } else {
        distanceA = a.cmfId ? locationDistances.get(a.cmfId) : undefined;
      }
      
      if (b.multipleLocations) {
        // Find closest location in the group
        const distances = b.units.map(rv => rv.cmfId ? locationDistances.get(rv.cmfId) : undefined).filter(d => d !== undefined) as number[];
        distanceB = distances.length > 0 ? Math.min(...distances) : undefined;
      } else {
        distanceB = b.cmfId ? locationDistances.get(b.cmfId) : undefined;
      }
      
      // Put items without distance at the end
      if (distanceA === undefined && distanceB === undefined) return 0;
      if (distanceA === undefined) return 1;
      if (distanceB === undefined) return -1;
      return distanceA - distanceB;
    }
    return 0;
  });

  const totalRegularPrice = sortedInventory.reduce((sum, rv) => sum + (rv.price * rv.quantity), 0);
  const totalDiscountedPrice = sortedInventory.reduce((sum, rv) => sum + (calculateDiscountedPrice(rv.price) * rv.quantity), 0);
  const totalSavings = totalRegularPrice - totalDiscountedPrice;
  
  // Filter unit classes to only show those that have RVs in the current location(s)
  // Use the fetched inventory which already respects location filter but may be filtered by type
  // We want to show all types that exist in the location, regardless of current type selection
  const availableUnitClasses = unitClasses.filter(unitClass => 
    inventory.some(rv => rv.type === unitClass.class)
  );

  // Pagination logic
  const totalItems = sortedInventory.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedInventory = sortedInventory.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/bishs_logo.jpg"
              alt="Bishs Logo"
              width={60}
              height={60}
            />
            <div className="hidden sm:block border-l-2 border-gray-200 h-12"></div>
            <Image
              src="/Kiewit-Logo.png"
              alt="Kiewit Logo"
              width={80}
              height={40}
              className="object-contain"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Welcome Section */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Bishs RV Portal • <span className="text-blue-600">Kiewit Exclusive</span>
          </h1>
          <p className="text-sm text-gray-600">
            {userEmail}
          </p>
        </div>

        {/* Zip Code Input Section */}
        <div className="mb-4 flex justify-end">
          <div className="text-right">
            <p className="text-xs text-gray-600 mb-2">Your zip code will determine the price to ship the RV to your house</p>
            <div className="flex items-center justify-end gap-2">
              <input
                type="text"
                placeholder="Enter ZIP Code"
                value={userZip}
                onChange={(e) => {
                  const zip = e.target.value.replace(/\D/g, '').slice(0, 5);
                  handleZipChange(zip);
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && userZip.length === 5) {
                    handleCalculateDistance();
                  }
                }}
                className="w-36 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-slate-600 focus:ring-1 focus:ring-slate-200 focus:outline-none"
                maxLength={5}
              />
              <button
                onClick={handleCalculateDistance}
                disabled={userZip.length !== 5 || isGeocodingZip}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isGeocodingZip ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    Calculating...
                  </>
                ) : (
                  'Calculate Distance'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Benefits Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-800">
            <strong>Your Benefits:</strong> 15% off MSRP + 0% financing for 120 months. {benefitsSavingsText}
          </p>
        </div>

        {/* Main Content Layout with Sidebar */}
        <div className="flex gap-6">
          {/* Desktop Sidebar Filters - Sticky on large screens */}
          <aside className="hidden lg:block w-80 shrink-0">
            <div className="sticky top-24 bg-white p-6 rounded-lg shadow-sm border border-gray-200 max-h-[calc(100vh-120px)] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Filters</h2>
                {(selectedTypes.length > 0 || selectedLocation !== 'all' || priceMin || priceMax || minSleeps > 0 || selectedManufacturers.length > 0) && (
                  <button
                    onClick={() => {
                      setSelectedTypes([]);
                      setSelectedLocation('all');
                      setPriceMin('');
                      setPriceMax('');
                      setMinPrice(0);
                      setMaxPrice(200000);
                      setMinSleeps(0);
                      setSelectedManufacturers([]);
                    }}
                    className="text-sm font-medium text-slate-600 hover:text-slate-700"
                  >
                    Clear All
                  </button>
                )}
              </div>
              
              <div className="space-y-6">
                {/* Manufacturer Filter */}
                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Manufacturer {selectedManufacturers.length > 0 && <span className="text-blue-600 text-xs">({selectedManufacturers.length})</span>}
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setIsManufacturerDropdownOpen(!isManufacturerDropdownOpen)}
                      className="w-full px-3 py-2 pr-8 bg-white border border-gray-300 rounded-lg text-left text-sm focus:border-slate-600 focus:ring-1 focus:ring-slate-200 focus:outline-none transition-all hover:border-gray-400"
                    >
                      <span className="text-gray-900">
                        {selectedManufacturers.length === 0 
                          ? 'All Manufacturers' 
                          : `${selectedManufacturers.length} selected`
                        }
                      </span>
                    </button>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                      <svg 
                        className={`h-5 w-5 transition-transform ${isManufacturerDropdownOpen ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    
                    {/* Dropdown Menu */}
                    {isManufacturerDropdownOpen && (
                      <>
                        {/* Backdrop to close dropdown when clicking outside */}
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setIsManufacturerDropdownOpen(false)}
                        />
                        
                        {/* Dropdown Content */}
                        <div 
                          className="absolute z-20 mt-2 w-full bg-white border-2 border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="p-2">
                            {uniqueManufacturers.map(manufacturer => {
                              const isSelected = selectedManufacturers.includes(manufacturer);
                              return (
                                <label
                                  key={manufacturer}
                                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                                    isSelected
                                      ? 'bg-blue-50 text-blue-900'
                                      : 'hover:bg-gray-50 text-gray-700'
                                  }`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      if (isSelected) {
                                        setSelectedManufacturers(selectedManufacturers.filter(m => m !== manufacturer));
                                      } else {
                                        setSelectedManufacturers([...selectedManufacturers, manufacturer]);
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                  />
                                  <span className="flex-1 font-medium text-sm">
                                    {manufacturer}
                                  </span>
                                </label>
                              );
                            })}
                            {selectedManufacturers.length > 0 && (
                              <div className="pt-2 mt-2 border-t border-gray-200">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedManufacturers([]);
                                  }}
                                  className="w-full px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                                >
                                  Clear Selection
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Location Filter */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Location
                  </label>
                  <div className="relative">
                    <select
                      value={selectedLocation}
                      onChange={(e) => setSelectedLocation(e.target.value)}
                      className="w-full appearance-none px-3 py-2 pr-8 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-slate-600 focus:ring-1 focus:ring-slate-200 focus:outline-none transition-all"
                      disabled={isLoadingInventory || isLoadingOptions}
                    >
                      <option value="all">All Locations</option>
                      {locations.map(loc => (
                        <option key={loc.cmf} value={loc.cmf}>
                          {loc.location} - {loc.storename}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* RV Type Filter */}
                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    RV Type {selectedTypes.length > 0 && <span className="text-blue-600 text-xs">({selectedTypes.length})</span>}
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setIsRvTypeDropdownOpen(!isRvTypeDropdownOpen)}
                      disabled={isLoadingOptions}
                      className="w-full px-3 py-2 pr-8 bg-white border border-gray-300 rounded-lg text-left text-sm focus:border-slate-600 focus:ring-1 focus:ring-slate-200 focus:outline-none transition-all hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="text-gray-900">
                        {selectedTypes.length === 0 
                          ? 'All RV Types' 
                          : `${selectedTypes.length} type${selectedTypes.length > 1 ? 's' : ''} selected`
                        }
                      </span>
                    </button>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                      <svg 
                        className={`h-5 w-5 transition-transform ${isRvTypeDropdownOpen ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    
                    {/* Dropdown Menu */}
                    {isRvTypeDropdownOpen && (
                      <>
                        {/* Backdrop to close dropdown when clicking outside */}
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setIsRvTypeDropdownOpen(false)}
                        />
                        
                        {/* Dropdown Content */}
                        <div 
                          className="absolute z-20 mt-2 w-full bg-white border-2 border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isLoadingOptions ? (
                            <div className="flex items-center gap-2 text-sm text-gray-500 p-4">
                              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                              </svg>
                              Loading types...
                            </div>
                          ) : (
                            <div className="p-2">
                              {availableUnitClasses.map(unitClass => {
                                const isSelected = selectedTypes.includes(unitClass.class);
                                return (
                                  <label
                                    key={unitClass.class_id}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                                      isSelected
                                        ? 'bg-blue-50 text-blue-900'
                                        : 'hover:bg-gray-50 text-gray-700'
                                    }`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        if (isSelected) {
                                          setSelectedTypes(selectedTypes.filter(t => t !== unitClass.class));
                                        } else {
                                          setSelectedTypes([...selectedTypes, unitClass.class]);
                                        }
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className="flex-1 font-medium text-sm">
                                      {unitClass.class_description || unitClass.class}
                                    </span>
                                  </label>
                                );
                              })}
                              {selectedTypes.length > 0 && (
                                <div className="pt-2 mt-2 border-t border-gray-200">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTypes([]);
                                    }}
                                    className="w-full px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                                  >
                                    Clear Selection
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Price Filter */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Price Range
                  </label>
                  <div className="space-y-3">
                    {/* Price Range Slider */}
                    <div className="px-1">
                      <div className="flex mb-2 items-center justify-between text-xs text-gray-600">
                        <span>${minPrice.toLocaleString()}</span>
                        <span>${maxPrice.toLocaleString()}{maxPrice >= 100000 ? '+' : ''}</span>
                      </div>
                      <Slider
                        range
                        min={0}
                        max={100000}
                        step={1000}
                        value={[minPrice, maxPrice]}
                        onChange={(value) => {
                          if (Array.isArray(value)) {
                            setMinPrice(value[0]);
                            setMaxPrice(value[1]);
                            setPriceMin(value[0].toString());
                            setPriceMax(value[1].toString());
                          }
                        }}
                        styles={{
                          track: {
                            backgroundColor: '#475569',
                            height: 6,
                          },
                          rail: {
                            backgroundColor: '#e5e7eb',
                            height: 6,
                          },
                          handle: {
                            backgroundColor: '#475569',
                            borderColor: '#475569',
                            opacity: 1,
                            width: 14,
                            height: 14,
                            marginTop: -4,
                          },
                        }}
                      />
                    </div>

                    {/* Price Input Fields */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Min Price
                        </label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                          <input
                            type="number"
                            value={priceMin}
                            onChange={(e) => {
                              const value = e.target.value;
                              setPriceMin(value);
                              if (value) {
                                const numValue = Number(value);
                                if (numValue >= 0 && numValue <= maxPrice) {
                                  setMinPrice(numValue);
                                }
                              } else {
                                setMinPrice(0);
                              }
                            }}
                            placeholder="0"
                            className="w-full pl-5 pr-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:border-slate-600 focus:ring-1 focus:ring-slate-200 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Max Price
                        </label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                          <input
                            type="number"
                            value={priceMax}
                            onChange={(e) => {
                              const value = e.target.value;
                              setPriceMax(value);
                              if (value) {
                                const numValue = Number(value);
                                if (numValue >= minPrice && numValue <= 100000) {
                                  setMaxPrice(numValue);
                                }
                              } else {
                                setMaxPrice(100000);
                              }
                            }}
                            placeholder="100000"
                            className="w-full pl-5 pr-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:border-slate-600 focus:ring-1 focus:ring-slate-200 focus:outline-none"
                          />
                          {maxPrice >= 100000 && (
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">+</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Monthly Payment Filter */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Monthly Payment
                  </label>
                  <div className="space-y-3">
                    {/* Monthly Payment Slider */}
                    <div className="px-1">
                      <div className="flex mb-2 items-center justify-between text-xs text-gray-600">
                        <span>${minMonthlyPayment.toLocaleString()}/mo</span>
                        <span>${maxMonthlyPayment.toLocaleString()}{maxMonthlyPayment >= maxMonthlyPaymentLimit ? '+' : ''}/mo</span>
                      </div>
                      <Slider
                        range
                        min={0}
                        max={maxMonthlyPaymentLimit}
                        step={50}
                        value={[minMonthlyPayment, Math.min(maxMonthlyPayment, maxMonthlyPaymentLimit)]}
                        onChange={(value) => {
                          if (Array.isArray(value)) {
                            setMinMonthlyPayment(value[0]);
                            setMaxMonthlyPayment(value[1]);
                            setMonthlyPaymentMin(value[0].toString());
                            setMonthlyPaymentMax(value[1].toString());
                          }
                        }}
                        styles={{
                          track: {
                            backgroundColor: '#475569',
                            height: 6,
                          },
                          rail: {
                            backgroundColor: '#e5e7eb',
                            height: 6,
                          },
                          handle: {
                            backgroundColor: '#475569',
                            borderColor: '#475569',
                            opacity: 1,
                            width: 14,
                            height: 14,
                            marginTop: -4,
                          },
                        }}
                      />
                    </div>

                    {/* Monthly Payment Input Fields */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Min Payment
                        </label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                          <input
                            type="number"
                            value={monthlyPaymentMin}
                            onChange={(e) => {
                              const value = e.target.value;
                              setMonthlyPaymentMin(value);
                              if (value) {
                                const numValue = Number(value);
                                if (numValue >= 0 && numValue <= maxMonthlyPayment) {
                                  setMinMonthlyPayment(numValue);
                                }
                              } else {
                                setMinMonthlyPayment(0);
                              }
                            }}
                            placeholder="0"
                            className="w-full pl-5 pr-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:border-slate-600 focus:ring-1 focus:ring-slate-200 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Max Payment
                        </label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                          <input
                            type="number"
                            value={monthlyPaymentMax}
                            onChange={(e) => {
                              const value = e.target.value;
                              setMonthlyPaymentMax(value);
                              if (value) {
                                const numValue = Number(value);
                                if (numValue >= minMonthlyPayment && numValue <= maxMonthlyPaymentLimit) {
                                  setMaxMonthlyPayment(numValue);
                                }
                              } else {
                                setMaxMonthlyPayment(maxMonthlyPaymentLimit);
                              }
                            }}
                            placeholder={maxMonthlyPaymentLimit.toString()}
                            className="w-full pl-5 pr-8 py-1.5 text-xs border border-gray-300 rounded-lg focus:border-slate-600 focus:ring-1 focus:ring-slate-200 focus:outline-none"
                          />
                          {maxMonthlyPayment >= maxMonthlyPaymentLimit && (
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">+</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sleeps Filter */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Minimum Sleeps
                  </label>
                  <div className="relative">
                    <select
                      value={minSleeps}
                      onChange={(e) => setMinSleeps(Number(e.target.value))}
                      className="w-full appearance-none px-3 py-2 pr-8 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-slate-600 focus:ring-1 focus:ring-slate-200 focus:outline-none"
                      disabled={isLoadingInventory}
                    >
                      <option value={0}>Any</option>
                      <option value={2}>2+</option>
                      <option value={4}>4+</option>
                      <option value={6}>6+</option>
                      <option value={8}>8+</option>
                      <option value={10}>10+</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Distance Filter */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Distance from Me
                  </label>
                  
                  {/* ZIP Code Input for Distance Calculation */}
                  <div className="mb-3 p-2 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-600 mb-1.5">Enter ZIP to calculate</p>
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        placeholder="ZIP Code"
                        value={userZip}
                        onChange={(e) => {
                          const zip = e.target.value.replace(/\D/g, '').slice(0, 5);
                          handleZipChange(zip);
                        }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && userZip.length === 5) {
                            handleCalculateDistance();
                          }
                        }}
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:border-slate-600 focus:ring-1 focus:ring-slate-200 focus:outline-none"
                        maxLength={5}
                      />
                      <button
                        onClick={handleCalculateDistance}
                        disabled={userZip.length !== 5 || isGeocodingZip}
                        className="w-full px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                      >
                        {isGeocodingZip ? 'Calculating...' : 'Calculate Distances'}
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <select
                      value={maxDistance}
                      onChange={(e) => setMaxDistance(Number(e.target.value))}
                      className="w-full appearance-none px-3 py-2 pr-8 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-slate-600 focus:ring-1 focus:ring-slate-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={locationDistances.size === 0 || isLoadingInventory}
                    >
                      <option value={10000}>Any Distance</option>
                      <option value={50}>Within 50 miles</option>
                      <option value={100}>Within 100 miles</option>
                      <option value={250}>Within 250 miles</option>
                      <option value={500}>Within 500 miles</option>
                      <option value={1000}>Within 1,000 miles</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  {locationDistances.size === 0 && (
                    <p className="mt-1 text-xs text-gray-500">Calculate distances above to enable filtering</p>
                  )}
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            {/* Mobile Filter Toggle Button - Only visible on mobile */}
            <div className="lg:hidden mb-4">
              <button
                onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-gray-900">Filters</span>
                <div className="flex items-center gap-2">
                  {(selectedTypes.length > 0 || selectedLocation !== 'all' || priceMin || priceMax || minSleeps > 0 || selectedManufacturers.length > 0) && (
                    <span className="px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded">
                      {[selectedTypes.length, selectedLocation !== 'all' ? 1 : 0, priceMin || priceMax ? 1 : 0, minSleeps > 0 ? 1 : 0, selectedManufacturers.length].reduce((a, b) => a + b, 0)} active
                    </span>
                  )}
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </div>
              </button>
            </div>
            {/* Sort and Pagination Controls */}
            <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg border border-gray-200">
              {/* Sort By */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-700 font-medium">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-1 border-2 border-gray-200 rounded-lg text-sm font-medium focus:border-slate-600 focus:ring-2 focus:ring-slate-200 focus:outline-none transition-all"
                >
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="discount-desc">Highest Discount</option>
                  {locationDistances.size > 0 && <option value="distance-asc">Distance (Nearest)</option>}
                </select>
              </div>
              
              {/* Items Per Page */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-700">Show:</span>
                {[20, 50, 100].map((size) => (
                  <button
                    key={size}
                    onClick={() => handleItemsPerPageChange(size)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      itemsPerPage === size
                        ? 'bg-slate-700 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {size}
                  </button>
                ))}
                <span className="text-sm text-gray-600">per page</span>
              </div>
              <div className="text-sm text-gray-600">
                Showing {totalItems === 0 ? 0 : startIndex + 1} - {Math.min(endIndex, totalItems)} of {totalItems} models
                {(() => {
                  const totalUnits = sortedInventory.reduce((sum, rv) => sum + rv.quantity, 0);
                  return totalUnits > totalItems ? ` (${totalUnits} total units)` : '';
                })()}
              </div>
            </div>

            {/* Inventory Grid */}
            {isLoadingInventory ? (
              <div className="text-center py-16 px-4">
                <div className="max-w-md mx-auto">
                  <div className="flex justify-center mb-6">
                    <svg className="animate-spin h-16 w-16 text-slate-700" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    Loading Inventory
                  </h3>
                  <p className="text-gray-600">
                    Please wait while we load available RVs...
                  </p>
                </div>
              </div>
            ) : paginatedInventory.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {paginatedInventory.map(rv => {
                  // Find the full RV type description
                  const rvTypeDescription = unitClasses.find(uc => uc.class === rv.type)?.class_description || undefined;
                  
                  // Calculate distance to nearest location for grouped RVs
                  let distanceInMiles: number | null = null;
                  if (rv.multipleLocations) {
                    // Find the closest location among all units
                    const distances = rv.units
                      .map(unit => unit.cmfId && locationDistances.has(unit.cmfId) ? locationDistances.get(unit.cmfId)! : null)
                      .filter(d => d !== null) as number[];
                    distanceInMiles = distances.length > 0 ? Math.min(...distances) : null;
                  } else {
                    // Single location - use its distance
                    distanceInMiles = rv.cmfId && locationDistances.has(rv.cmfId) ? locationDistances.get(rv.cmfId)! : null;
                  }
                  
                  // Get location names for tooltip (for grouped RVs with multiple locations)
                  const locationNames = rv.multipleLocations 
                    ? rv.units
                        .map(unit => {
                          const loc = locations.find(l => l.cmf === unit.cmfId);
                          return loc ? loc.storename || loc.location : null;
                        })
                        .filter((name, index, self) => name && self.indexOf(name) === index) // unique names only
                    : [];

                  return (
                    <RVCard
                      key={rv.id}
                      rv={rv}
                      discountPercent={KIEWIT_DISCOUNT_PERCENT}
                      typeDescription={rvTypeDescription}
                      locations={locations}
                      distanceInMiles={distanceInMiles}
                      locationNames={locationNames as string[]}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 px-4">
                <div className="max-w-md mx-auto">
                  <svg className="w-24 h-24 mx-auto text-gray-300 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    No RVs Found
                  </h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    We couldn't find any RVs matching your current filter criteria. Try adjusting your filters to see more results.
                  </p>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                    <p className="text-sm text-gray-900 font-semibold mb-2">Suggestions:</p>
                    <ul className="text-sm text-gray-700 space-y-1 text-left">
                      <li>• Remove or broaden your manufacturer selection</li>
                      <li>• Try selecting "All Locations" to see more options</li>
                      <li>• Adjust your price range to include more RVs</li>
                      <li>• Increase the distance filter if you're searching by location</li>
                      <li>• Select more RV types to expand your search</li>
                    </ul>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedTypes([]);
                      setSelectedLocation('all');
                      setPriceMin('');
                      setPriceMax('');
                      setMinPrice(0);
                      setMaxPrice(200000);
                      setMinSleeps(0);
                      setMaxDistance(10000);
                      setSelectedManufacturers([]);
                    }}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-slate-700 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Clear All Filters
                  </button>
                </div>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex justify-center items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border-2 border-gray-200 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Previous
                </button>
                
                <div className="flex gap-2">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          currentPage === pageNum
                            ? 'bg-slate-700 text-white'
                            : 'border-2 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border-2 border-gray-200 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
          
        {/* Mobile filter panel - slides in from right */}
          <div 
            className={`lg:hidden fixed inset-y-0 right-0 z-50 w-80 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${
              isFilterMenuOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="h-full overflow-y-auto">
              {/* Mobile panel header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Filters</h3>
                <button
                  onClick={() => setIsFilterMenuOpen(false)}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Mobile filters content */}
              <div className="p-4 space-y-6">
                  {/* Manufacturer Filter */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Manufacturer {selectedManufacturers.length > 0 && <span className="text-blue-600 text-xs">({selectedManufacturers.length})</span>}
                    </label>
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                      {uniqueManufacturers.map(manufacturer => {
                        const isSelected = selectedManufacturers.includes(manufacturer);
                        return (
                          <label
                            key={manufacturer}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-blue-50 text-blue-900'
                                : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                if (isSelected) {
                                  setSelectedManufacturers(selectedManufacturers.filter(m => m !== manufacturer));
                                } else {
                                  setSelectedManufacturers([...selectedManufacturers, manufacturer]);
                                }
                              }}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="flex-1 text-sm font-medium">
                              {manufacturer}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Location Filter */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Location
                    </label>
                    <div className="relative">
                      <select
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        className="w-full appearance-none px-3 py-2 pr-8 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-slate-600 focus:ring-1 focus:ring-slate-200 focus:outline-none transition-all"
                        disabled={isLoadingInventory || isLoadingOptions}
                      >
                        <option value="all">All Locations</option>
                        {locations.map(loc => (
                          <option key={loc.cmf} value={loc.cmf}>
                            {loc.location} - {loc.storename}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* RV Type Filter */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      RV Type {selectedTypes.length > 0 && <span className="text-blue-600 text-xs">({selectedTypes.length})</span>}
                    </label>
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                      {isLoadingOptions ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500 p-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                          </svg>
                          Loading types...
                        </div>
                      ) : (
                        availableUnitClasses.map(unitClass => {
                          const isSelected = selectedTypes.includes(unitClass.class);
                          return (
                            <label
                              key={unitClass.class_id}
                              className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-blue-50 text-blue-900'
                                  : 'hover:bg-gray-50 text-gray-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  if (isSelected) {
                                    setSelectedTypes(selectedTypes.filter(t => t !== unitClass.class));
                                  } else {
                                    setSelectedTypes([...selectedTypes, unitClass.class]);
                                  }
                                }}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="flex-1 text-sm font-medium">
                                {unitClass.class_description || unitClass.class}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Price Filter */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Price Range
                    </label>
                    <div className="space-y-3">
                      {/* Price Range Slider */}
                      <div className="px-1">
                        <div className="flex mb-2 items-center justify-between text-xs text-gray-600">
                          <span>${minPrice.toLocaleString()}</span>
                          <span>${maxPrice.toLocaleString()}{maxPrice >= 100000 ? '+' : ''}</span>
                        </div>
                        <Slider
                          range
                          min={0}
                          max={100000}
                          step={1000}
                          value={[minPrice, maxPrice]}
                          onChange={(value) => {
                            if (Array.isArray(value)) {
                              setMinPrice(value[0]);
                              setMaxPrice(value[1]);
                              setPriceMin(value[0].toString());
                              setPriceMax(value[1].toString());
                            }
                          }}
                          styles={{
                            track: {
                              backgroundColor: '#475569',
                              height: 6,
                            },
                            rail: {
                              backgroundColor: '#e5e7eb',
                              height: 6,
                            },
                            handle: {
                              backgroundColor: '#475569',
                              borderColor: '#475569',
                              opacity: 1,
                              width: 14,
                              height: 14,
                              marginTop: -4,
                            },
                          }}
                        />
                      </div>

                      {/* Price Input Fields */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Min Price
                          </label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                            <input
                              type="number"
                              value={priceMin}
                              onChange={(e) => {
                                const value = e.target.value;
                                setPriceMin(value);
                                if (value) {
                                  const numValue = Number(value);
                                  if (numValue >= 0 && numValue <= maxPrice) {
                                    setMinPrice(numValue);
                                  }
                                } else {
                                  setMinPrice(0);
                                }
                              }}
                              placeholder="0"
                              className="w-full pl-5 pr-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:border-slate-600 focus:ring-1 focus:ring-slate-200 focus:outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Max Price
                          </label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                            <input
                              type="number"
                              value={priceMax}
                              onChange={(e) => {
                                const value = e.target.value;
                                setPriceMax(value);
                                if (value) {
                                  const numValue = Number(value);
                                  if (numValue >= minPrice && numValue <= 100000) {
                                    setMaxPrice(numValue);
                                  }
                                } else {
                                  setMaxPrice(100000);
                                }
                              }}
                              placeholder="100000"
                              className="w-full pl-5 pr-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:border-slate-600 focus:ring-1 focus:ring-slate-200 focus:outline-none"
                            />
                            {maxPrice >= 100000 && (
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">+</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Monthly Payment Filter */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Monthly Payment
                    </label>
                    <div className="space-y-3">
                      {/* Monthly Payment Slider */}
                      <div className="px-1">
                        <div className="flex mb-2 items-center justify-between text-xs text-gray-600">
                          <span>${minMonthlyPayment.toLocaleString()}/mo</span>
                          <span>${maxMonthlyPayment.toLocaleString()}{maxMonthlyPayment >= maxMonthlyPaymentLimit ? '+' : ''}/mo</span>
                        </div>
                        <Slider
                          range
                          min={0}
                          max={maxMonthlyPaymentLimit}
                          step={50}
                          value={[minMonthlyPayment, Math.min(maxMonthlyPayment, maxMonthlyPaymentLimit)]}
                          onChange={(value) => {
                            if (Array.isArray(value)) {
                              setMinMonthlyPayment(value[0]);
                              setMaxMonthlyPayment(value[1]);
                              setMonthlyPaymentMin(value[0].toString());
                              setMonthlyPaymentMax(value[1].toString());
                            }
                          }}
                          styles={{
                            track: {
                              backgroundColor: '#475569',
                              height: 6,
                            },
                            rail: {
                              backgroundColor: '#e5e7eb',
                              height: 6,
                            },
                            handle: {
                              backgroundColor: '#475569',
                              borderColor: '#475569',
                              opacity: 1,
                              width: 14,
                              height: 14,
                              marginTop: -4,
                            },
                          }}
                        />
                      </div>

                      {/* Monthly Payment Input Fields */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Min Payment
                          </label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                            <input
                              type="number"
                              value={monthlyPaymentMin}
                              onChange={(e) => {
                                const value = e.target.value;
                                setMonthlyPaymentMin(value);
                                if (value) {
                                  const numValue = Number(value);
                                  if (numValue >= 0 && numValue <= maxMonthlyPayment) {
                                    setMinMonthlyPayment(numValue);
                                  }
                                } else {
                                  setMinMonthlyPayment(0);
                                }
                              }}
                              placeholder="0"
                              className="w-full pl-5 pr-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:border-slate-600 focus:ring-1 focus:ring-slate-200 focus:outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Max Payment
                          </label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                            <input
                              type="number"
                              value={monthlyPaymentMax}
                              onChange={(e) => {
                                const value = e.target.value;
                                setMonthlyPaymentMax(value);
                                if (value) {
                                  const numValue = Number(value);
                                  if (numValue >= minMonthlyPayment && numValue <= maxMonthlyPaymentLimit) {
                                    setMaxMonthlyPayment(numValue);
                                  }
                                } else {
                                  setMaxMonthlyPayment(maxMonthlyPaymentLimit);
                                }
                              }}
                              placeholder={maxMonthlyPaymentLimit.toString()}
                              className="w-full pl-5 pr-8 py-1.5 text-xs border border-gray-300 rounded-lg focus:border-slate-600 focus:ring-1 focus:ring-slate-200 focus:outline-none"
                            />
                            {maxMonthlyPayment >= maxMonthlyPaymentLimit && (
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">+</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sleeps Filter */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Minimum Sleeps
                    </label>
                    <div className="relative">
                      <select
                        value={minSleeps}
                        onChange={(e) => setMinSleeps(Number(e.target.value))}
                        className="w-full appearance-none px-3 py-2 pr-8 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-slate-600 focus:ring-1 focus:ring-slate-200 focus:outline-none"
                        disabled={isLoadingInventory}
                      >
                        <option value={0}>Any</option>
                        <option value={2}>2+</option>
                        <option value={4}>4+</option>
                        <option value={6}>6+</option>
                        <option value={8}>8+</option>
                        <option value={10}>10+</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Distance Filter */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Distance from Me
                    </label>
                    
                    {/* ZIP Code Input for Distance Calculation */}
                    <div className="mb-3 p-2 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 mb-1.5">Enter ZIP to calculate</p>
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          placeholder="ZIP Code"
                          value={userZip}
                          onChange={(e) => {
                            const zip = e.target.value.replace(/\D/g, '').slice(0, 5);
                            handleZipChange(zip);
                          }}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && userZip.length === 5) {
                              handleCalculateDistance();
                            }
                          }}
                          className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:border-slate-600 focus:ring-1 focus:ring-slate-200 focus:outline-none"
                          maxLength={5}
                        />
                        <button
                          onClick={handleCalculateDistance}
                          disabled={userZip.length !== 5 || isGeocodingZip}
                          className="w-full px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                        >
                          {isGeocodingZip ? 'Calculating...' : 'Calculate Distances'}
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <select
                        value={maxDistance}
                        onChange={(e) => setMaxDistance(Number(e.target.value))}
                        className="w-full appearance-none px-3 py-2 pr-8 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-slate-600 focus:ring-1 focus:ring-slate-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={locationDistances.size === 0 || isLoadingInventory}
                      >
                        <option value={10000}>Any Distance</option>
                        <option value={50}>Within 50 miles</option>
                        <option value={100}>Within 100 miles</option>
                        <option value={250}>Within 250 miles</option>
                        <option value={500}>Within 500 miles</option>
                        <option value={1000}>Within 1,000 miles</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    {locationDistances.size === 0 && (
                      <p className="mt-1 text-xs text-gray-500">Calculate distances above to enable filtering</p>
                    )}
                  </div>

                  {/* Clear All Button */}
                  {(selectedTypes.length > 0 || selectedLocation !== 'all' || priceMin || priceMax || minSleeps > 0 || selectedManufacturers.length > 0) && (
                    <button
                      onClick={() => {
                        setSelectedTypes([]);
                        setSelectedLocation('all');
                        setPriceMin('');
                        setPriceMax('');
                        setMinPrice(0);
                        setMaxPrice(200000);
                        setMinSleeps(0);
                        setSelectedManufacturers([]);
                      }}
                      className="w-full px-4 py-2 text-sm font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              </div>
            </div>

          {/* Overlay for mobile menu */}
          {isFilterMenuOpen && (
            <div 
              className="lg:hidden fixed inset-0 bg-black/30 z-40"
              onClick={() => setIsFilterMenuOpen(false)}
            />
          )}
        </main>
    </div>
  );
}
