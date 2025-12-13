'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { RV } from '@/types/inventory';
import RVCard from '@/components/RVCard';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';

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
  const [locations, setLocations] = useState<Array<{ cmf: number; location: string; storename: string }>>([]);
  const [unitClasses, setUnitClasses] = useState<Array<{ class_id: number; class: string; class_description: string | null }>>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  
  // Price filter state
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(100000);
  const [priceMin, setPriceMin] = useState<string>('');
  const [priceMax, setPriceMax] = useState<string>('');
  
  // RV Type dropdown state
  const [isRvTypeDropdownOpen, setIsRvTypeDropdownOpen] = useState(false);
  
  // Sleeps filter state
  const [minSleeps, setMinSleeps] = useState<number>(0);
  
  // Sort state
  const [sortBy, setSortBy] = useState<'price-asc' | 'price-desc' | 'discount-desc'>('price-asc');

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
        
        // Add class filter if any types selected
        if (selectedTypes.length > 0) {
          params.append('classNames', selectedTypes.join(','));
        }
        
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
  }, [selectedTypes, selectedLocation, locations, isLoadingOptions]);

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

  // Calculate Kiewit employee discount (15% off)
  const KIEWIT_DISCOUNT_PERCENT = 0.15;
  const calculateDiscountedPrice = (price: number) => Math.round(price * (1 - KIEWIT_DISCOUNT_PERCENT));
  
  // Client-side price and sleeps filtering
  const filteredInventory = inventory.filter(rv => {
    // Exclude RVs with no price (0 or null)
    if (!rv.price || rv.price <= 0) return false;
    if (minPrice > 0 && rv.price < minPrice) return false;
    if (maxPrice < 200000 && rv.price > maxPrice) return false;
    // Filter by sleeps
    if (minSleeps > 0 && rv.sleeps < minSleeps) return false;
    return true;
  });
  
  // Sort filtered inventory
  const sortedInventory = [...filteredInventory].sort((a, b) => {
    if (sortBy === 'price-asc') {
      return a.price - b.price;
    } else if (sortBy === 'price-desc') {
      return b.price - a.price;
    } else if (sortBy === 'discount-desc') {
      const savingsA = a.price * KIEWIT_DISCOUNT_PERCENT;
      const savingsB = b.price * KIEWIT_DISCOUNT_PERCENT;
      return savingsB - savingsA;
    }
    return 0;
  });

  const totalRegularPrice = sortedInventory.reduce((sum, rv) => sum + rv.price, 0);
  const totalDiscountedPrice = sortedInventory.reduce((sum, rv) => sum + calculateDiscountedPrice(rv.price), 0);
  const totalSavings = totalRegularPrice - totalDiscountedPrice;
  
  // Filter unit classes to only show those with inventory
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
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Image
              src="/bishs_logo.jpg"
              alt="Bishs Logo"
              width={80}
              height={80}
            />
            <div className="hidden sm:block border-l-2 border-gray-200 h-16"></div>
            <Image
              src="/Kiewit-Logo.png"
              alt="Kiewit Logo"
              width={100}
              height={50}
              className="object-contain"
            />
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Logout
          </button>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Welcome to Bishs RV Portal
          </h1>
          <p className="text-lg text-gray-600 mb-4">
            Kiewit Employee Exclusive Pricing
          </p>
          <p className="text-gray-600 mb-2">
            {userEmail}
          </p>
          <p className="text-gray-600">
            Browse our exclusive curated selection of RVs available at special Kiewit employee pricing.
          </p>
        </div>

        {/* Benefits Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-blue-900 mb-2">Your Exclusive Benefits</h2>
          <p className="text-blue-800">
            Enjoy <strong>15% off</strong> all RVs with your Kiewit employee discount. {filteredInventory.length > 0 && <span>Save up to <strong>${(Math.max(...filteredInventory.map(rv => rv.price * KIEWIT_DISCOUNT_PERCENT))).toLocaleString()}</strong> per vehicle.</span>}
          </p>
        </div>

        {/* Filter and Pagination Controls */}
        <div className="mb-8 space-y-6">
          {/* Filters */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Filters</h2>
              {(selectedTypes.length > 0 || selectedLocation !== 'all' || priceMin || priceMax || minSleeps > 0) && (
                <button
                  onClick={() => {
                    setSelectedTypes([]);
                    setSelectedLocation('all');
                    setPriceMin('');
                    setPriceMax('');
                    setMinPrice(0);
                    setMaxPrice(200000);
                    setMinSleeps(0);
                  }}
                  className="text-sm font-medium text-slate-600 hover:text-slate-700"
                >
                  Clear All
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Location Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Location
                </label>
                <div className="relative">
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="w-full appearance-none px-4 py-3 pr-10 bg-white border-2 border-gray-200 rounded-xl text-gray-900 font-medium focus:border-slate-600 focus:ring-2 focus:ring-slate-200 focus:outline-none transition-all hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
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
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  RV Type {selectedTypes.length > 0 && <span className="text-blue-600">({selectedTypes.length})</span>}
                </label>
                <div className="relative">
                  <button
                    onClick={() => setIsRvTypeDropdownOpen(!isRvTypeDropdownOpen)}
                    disabled={isLoadingOptions || isLoadingInventory}
                    className="w-full px-4 py-3 pr-10 bg-white border-2 border-gray-200 rounded-xl text-left font-medium focus:border-slate-600 focus:ring-2 focus:ring-slate-200 focus:outline-none transition-all hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
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
                      {/* Backdrop to close dropdown */}
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setIsRvTypeDropdownOpen(false)}
                      />
                      
                      {/* Dropdown Content */}
                      <div className="absolute z-20 mt-2 w-full bg-white border-2 border-gray-200 rounded-xl shadow-lg max-h-80 overflow-y-auto">
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
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Price Range
                </label>
                <div className="space-y-4">
                  {/* Price Range Slider */}
                  <div className="px-2">
                    <div className="relative pt-1">
                      <div className="flex mb-2 items-center justify-between text-xs text-gray-600">
                        <span>${minPrice.toLocaleString()}</span>
                        <span>${maxPrice.toLocaleString()}</span>
                      </div>
                      <div className="px-1">
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
                              backgroundColor: '#475569', // slate-600
                              height: 8,
                            },
                            rail: {
                              backgroundColor: '#e5e7eb', // gray-200
                              height: 8,
                            },
                            handle: {
                              backgroundColor: '#475569', // slate-600
                              borderColor: '#475569',
                              opacity: 1,
                              width: 18,
                              height: 18,
                              marginTop: -5,
                            },
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Price Input Fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Min Price
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
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
                          className="w-full pl-7 pr-3 py-2 border-2 border-gray-200 rounded-lg focus:border-slate-600 focus:ring-2 focus:ring-slate-200 focus:outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Max Price
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                        <input
                          type="number"
                          value={priceMax}
                          onChange={(e) => {
                            const value = e.target.value;
                            setPriceMax(value);
                            if (value) {
                              const numValue = Number(value);
                              if (numValue >= minPrice && numValue <= 200000) {
                                setMaxPrice(numValue);
                              }
                            } else {
                              setMaxPrice(200000);
                            }
                          }}
                          placeholder="200000"
                          className="w-full pl-7 pr-3 py-2 border-2 border-gray-200 rounded-lg focus:border-slate-600 focus:ring-2 focus:ring-slate-200 focus:outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sleeps Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Minimum Sleeps
                </label>
                <select
                  value={minSleeps}
                  onChange={(e) => setMinSleeps(Number(e.target.value))}
                  className="w-full appearance-none px-4 py-3 pr-10 bg-white border-2 border-gray-200 rounded-xl text-gray-900 font-medium focus:border-slate-600 focus:ring-2 focus:ring-slate-200 focus:outline-none transition-all hover:border-gray-300"
                  disabled={isLoadingInventory}
                >
                  <option value={0}>Any</option>
                  <option value={2}>2+</option>
                  <option value={4}>4+</option>
                  <option value={6}>6+</option>
                  <option value={8}>8+</option>
                  <option value={10}>10+</option>
                </select>
              </div>
            </div>
            
            {isLoadingInventory && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  <span className="font-medium">Loading inventory...</span>
                </div>
              </div>
            )}
          </div>

          {/* Sort and Pagination Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg border border-gray-200">
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
              <span className="text-sm text-gray-600">
                per page
              </span>
            </div>
            <div className="text-sm text-gray-600">
              Showing {totalItems === 0 ? 0 : startIndex + 1} - {Math.min(endIndex, totalItems)} of {totalItems} RVs
            </div>
          </div>
        </div>

        {/* Inventory Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedInventory.map(rv => {
            // Find the full RV type description
            const rvTypeDescription = unitClasses.find(uc => uc.class === rv.type)?.class_description || undefined;
            
            return (
              <RVCard
                key={rv.id}
                rv={rv}
                discountPercent={KIEWIT_DISCOUNT_PERCENT}
                typeDescription={rvTypeDescription}
                onBuyNow={(rv) => {
                  // TODO: Implement buy now functionality
                  console.log('Buy now clicked for:', rv);
                }}
                onViewDetails={(rv) => {
                  // Open Bish's website with stock number
                  window.open(`https://www.bishs.com/new-rvs-for-sale?stock=${rv.stock}`, '_blank');
                }}
              />
            );
          })}
        </div>

        {!isLoadingInventory && inventory.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">No RVs found matching your filters.</p>
            {(selectedTypes.length > 0 || selectedLocation !== 'all') && (
              <button
                onClick={() => {
                  setSelectedTypes([]);
                  setSelectedLocation('all');
                }}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Clear All Filters
              </button>
            )}
          </div>
        )}

        {/* Bottom Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:hover:bg-white"
              >
                Previous
              </button>
              
              <div className="flex gap-1">
                {/* First page */}
                {currentPage > 3 && (
                  <>
                    <button
                      onClick={() => handlePageChange(1)}
                      className="w-10 h-10 text-sm font-medium rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      1
                    </button>
                    {currentPage > 4 && (
                      <span className="w-10 h-10 flex items-center justify-center text-gray-500">...</span>
                    )}
                  </>
                )}

                {/* Page numbers around current page */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    return page === currentPage || 
                           page === currentPage - 1 || 
                           page === currentPage + 1 ||
                           (currentPage <= 2 && page <= 3) ||
                           (currentPage >= totalPages - 1 && page >= totalPages - 2);
                  })
                  .map(page => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`w-10 h-10 text-sm font-medium rounded-lg transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                {/* Last page */}
                {currentPage < totalPages - 2 && (
                  <>
                    {currentPage < totalPages - 3 && (
                      <span className="w-10 h-10 flex items-center justify-center text-gray-500">...</span>
                    )}
                    <button
                      onClick={() => handlePageChange(totalPages)}
                      className="w-10 h-10 text-sm font-medium rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:hover:bg-white"
              >
                Next
              </button>
            </div>

            <div className="text-sm text-gray-600">
              Showing {totalItems === 0 ? 0 : startIndex + 1} - {Math.min(endIndex, totalItems)} of {totalItems}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
