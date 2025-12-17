'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { RV } from '@/types/inventory';
import Image from 'next/image';
import { getPrimaryImage } from '@/lib/rvImages';
import Autocomplete from 'react-google-autocomplete';
import { PatternFormat } from 'react-number-format';
import { calculateDrivingDistances, LocationWithCoordinates } from '@/lib/distance';
import Script from 'next/script';

type Step = 'configuration' | 'contact' | 'review';

interface ConfigurationData {
  powerPackage?: string;
  hitchPackage?: string;
  brakeControl?: string;
  paymentMethod: 'cash' | 'finance';
  deliveryMethod: 'pickup' | 'ship';
  selectedStock?: string; // Which specific unit the user selects
  shippingAddressSameAsCustomer?: boolean; // Whether shipping address equals customer address
  shippingAddress?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingZipCode?: string;
  ownershipProtection: {
    extendedServiceContract: boolean;
    paintAndFabric: boolean;
    tireAndWheel: boolean;
    monsterSeal: boolean;
    gap: boolean;
    fiveYearRoadside: boolean;
    rvLife: boolean;
    lifetimeBattery: boolean;
    roof: boolean;
  };
}

interface ContactData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

const KIEWIT_DISCOUNT_PERCENT = 0.15;

// Helper function to parse model slug back to components
function parseModelSlug(slug: string): { manufacturer?: string; make?: string; model?: string; year?: string } {
  const parts = slug.split('-');
  // This is a simple parse - in production you might want more robust logic
  return {
    manufacturer: parts[0],
    make: parts[1],
    model: parts.slice(2, -1).join(' '),
    year: parts[parts.length - 1]
  };
}

export default function PurchaseWorkflow() {
  const router = useRouter();
  const params = useParams();
  const modelSlug = params.model as string;
  
  const [userEmail, setUserEmail] = useState('');
  const [availableUnits, setAvailableUnits] = useState<RV[]>([]); // All units of this model
  const [selectedRV, setSelectedRV] = useState<RV | null>(null); // Currently selected unit
  const [locations, setLocations] = useState<Array<{ cmf: number; location: string; storename: string; latitude: number | null; longitude: number | null }>>([]);
  const [unitDistances, setUnitDistances] = useState<Map<string, number>>(new Map()); // Map of stock number to distance in miles
  const [isCalculatingDistances, setIsCalculatingDistances] = useState(false);
  const [sortBy, setSortBy] = useState<'distance' | 'price'>('price'); // How to sort available units - default to price
  const [currentStep, setCurrentStep] = useState<Step>('configuration');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [userZip, setUserZip] = useState<string>('');
  const [protectionOptOut, setProtectionOptOut] = useState(false);
  const [expandedProtection, setExpandedProtection] = useState<string | null>(null);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);

  const [configurationData, setConfigurationData] = useState<ConfigurationData>({
    paymentMethod: 'finance',
    deliveryMethod: 'pickup',
    shippingAddressSameAsCustomer: true,
    ownershipProtection: {
      extendedServiceContract: false,
      paintAndFabric: false,
      tireAndWheel: false,
      monsterSeal: false,
      gap: false,
      fiveYearRoadside: false,
      rvLife: false,
      lifetimeBattery: false,
      roof: false,
    },
  });

  const [contactData, setContactData] = useState<ContactData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
  });

  useEffect(() => {
    // Check if user is verified
    const verified = localStorage.getItem('verified');
    const email = localStorage.getItem('userEmail');

    if (!verified || !email) {
      router.push('/');
      return;
    }

    setUserEmail(email);
    
    // Pre-populate contact data from localStorage
    setContactData(prev => ({
      ...prev,
      email: email
    }));
    
    // Load zip code from localStorage if available
    const savedZip = localStorage.getItem('userZip');
    if (savedZip) {
      setUserZip(savedZip);
    }

    // Fetch all RVs matching this model
    async function fetchModelUnits() {
      try {
        // First, get all locations
        const locationsResponse = await fetch('/api/init');
        const locationsResult = await locationsResponse.json();
        
        if (!locationsResult.success) {
          console.error('Failed to load locations');
          router.push('/portal');
          return;
        }
        
        const locations = locationsResult.data.locations;
        setLocations(locations); // Store locations in state
        const allLocationIds = locations.map((loc: any) => loc.cmf).join(',');
        
        // Get all inventory from all locations
        const response = await fetch(`/api/inventory?locationIds=${allLocationIds}`);
        const result = await response.json();
        
        if (result.success) {
          // Parse the model slug to get matching criteria
          const parsedModel = parseModelSlug(modelSlug);
          
          // Filter inventory to find all units matching this model
          const matchingUnits = result.data.filter((item: RV) => {
            const itemSlug = [
              item.manufacturer,
              item.make,
              item.model,
              item.year
            ].filter(Boolean)
              .join('-')
              .toLowerCase()
              .replace(/[^a-z0-9-]/g, '-')
              .replace(/-+/g, '-')
              .replace(/^-|-$/g, '');
            
            return itemSlug === modelSlug;
          });
          
          if (matchingUnits.length > 0) {
            setAvailableUnits(matchingUnits);
            // Default to the first unit
            setSelectedRV(matchingUnits[0]);
            setConfigurationData(prev => ({
              ...prev,
              selectedStock: matchingUnits[0].stock
            }));
          } else {
            console.error('No units found for model:', modelSlug);
            router.push('/portal');
          }
        } else {
          console.error('Failed to load inventory:', result.error);
          router.push('/portal');
        }
      } catch (err) {
        console.error('Error fetching model units:', err);
        router.push('/portal');
      }
    }

    fetchModelUnits();
  }, [modelSlug, router]);

  // Check if Google Maps API is loaded
  useEffect(() => {
    const checkGoogleMapsLoaded = () => {
      if (typeof window !== 'undefined' && window.google && window.google.maps && window.google.maps.places) {
        setIsGoogleMapsLoaded(true);
        return true;
      }
      return false;
    };

    // Check immediately
    if (checkGoogleMapsLoaded()) {
      return;
    }

    // Poll for the API to be loaded
    const interval = setInterval(() => {
      if (checkGoogleMapsLoaded()) {
        clearInterval(interval);
      }
    }, 100);

    // Also check on window load in case it's still loading
    if (typeof window !== 'undefined') {
      window.addEventListener('load', checkGoogleMapsLoaded);
    }

    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('load', checkGoogleMapsLoaded);
      }
    };
  }, []);

  // Calculate distances when customer enters address for either pickup or ship-to
  useEffect(() => {
    // For pickup: use customer ZIP code
    if (configurationData.deliveryMethod === 'pickup' && contactData.zipCode.length === 5 && availableUnits.length > 0 && locations.length > 0) {
      calculateDistancesToUnits(contactData.zipCode);
    }
    // For ship-to: use shipping ZIP code
    else if (configurationData.deliveryMethod === 'ship' && configurationData.shippingZipCode?.length === 5 && availableUnits.length > 0 && locations.length > 0) {
      calculateDistancesToUnits(configurationData.shippingZipCode);
    }
  }, [contactData.zipCode, configurationData.deliveryMethod, configurationData.shippingZipCode, availableUnits.length, locations.length]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const calculateDiscountedPrice = (originalPrice: number) => {
    return Math.round(originalPrice * (1 - KIEWIT_DISCOUNT_PERCENT));
  };

  const calculateShippingCost = (distanceInMiles: number) => {
    const COST_PER_MILE = 2.50;
    return distanceInMiles * COST_PER_MILE;
  };

  // Sort available units based on selected sort option
  const sortedUnits = useMemo(() => {
    const units = [...availableUnits];
    const isShipTo = configurationData.deliveryMethod === 'ship';
    
    if (sortBy === 'distance' && unitDistances.size > 0) {
      // Sort by distance (closest first)
      units.sort((a, b) => {
        const distA = unitDistances.get(a.stock) ?? Infinity;
        const distB = unitDistances.get(b.stock) ?? Infinity;
        return distA - distB;
      });
    } else if (sortBy === 'price') {
      // Sort by price - use grand total if ship-to is selected
      units.sort((a, b) => {
        const priceA = calculateDiscountedPrice(a.price);
        const priceB = calculateDiscountedPrice(b.price);
        
        // If ship-to, add shipping cost to get grand total
        if (isShipTo) {
          const distanceA = unitDistances.get(a.stock);
          const distanceB = unitDistances.get(b.stock);
          const shippingA = distanceA ? calculateShippingCost(distanceA) : 0;
          const shippingB = distanceB ? calculateShippingCost(distanceB) : 0;
          return (priceA + shippingA) - (priceB + shippingB);
        }
        
        return priceA - priceB;
      });
    }
    
    return units;
  }, [availableUnits, sortBy, unitDistances, configurationData.deliveryMethod]);

  const calculateMonthlyPayment = (price: number) => {
    const DOWN_PAYMENT_PERCENT = 0.20;
    const APR = 0.0525; // 5.25%
    const MONTHS = 120;

    const downPayment = price * DOWN_PAYMENT_PERCENT;
    const loanAmount = price - downPayment;
    const monthlyRate = APR / 12;

    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, MONTHS)) / (Math.pow(1 + monthlyRate, MONTHS) - 1);

    return Math.round(monthlyPayment);
  };

  const calculateShippingMonthlyPayment = (totalShippingCost: number) => {
    const SHIPPING_FINANCE_MONTHS = 120;
    return totalShippingCost / SHIPPING_FINANCE_MONTHS;
  };

  // Ownership Protection Pricing
  const OWNERSHIP_PROTECTION_PRICES = {
    extendedServiceContract: 2287,
    paintAndFabric: 995,
    tireAndWheel: 747.50,
    monsterSeal: 1023,
    gap: 975,
    fiveYearRoadside: 240,
    rvLife: 780,
    lifetimeBattery: 615,
    roof: 1713.50,
  };

  const calculateOwnershipProtectionTotal = () => {
    let total = 0;
    Object.entries(configurationData.ownershipProtection).forEach(([key, selected]) => {
      if (selected) {
        total += OWNERSHIP_PROTECTION_PRICES[key as keyof typeof OWNERSHIP_PROTECTION_PRICES];
      }
    });
    return total;
  };

  // Calculate Sales Prep Cost based on RV price tiers
  const calculateSalesPrepCost = (rvPrice: number) => {
    if (rvPrice >= 150000) return 1807.50;
    if (rvPrice >= 100000) return 1807.50;
    if (rvPrice >= 80000) return 1413.75;
    if (rvPrice >= 60000) return 1145.00;
    if (rvPrice >= 40000) return 892.50;
    if (rvPrice >= 30000) return 820.00;
    if (rvPrice >= 25000) return 657.50;
    if (rvPrice >= 20000) return 567.50;
    if (rvPrice >= 15000) return 365.00;
    return 320.00; // Default for $10,000 and below
  };

  const calculateTotalPrice = () => {
    if (!selectedRV) return 0;
    let total = calculateDiscountedPrice(selectedRV.price);
    
    // Add option prices
    if (configurationData.powerPackage === 'standard') total += 419;
    if (configurationData.powerPackage === '6volt') total += 555;
    if (configurationData.powerPackage === 'lithium') total += 1299;
    if (configurationData.hitchPackage === 'anti-sway') total += 600;
    if (configurationData.hitchPackage === 'fifth-wheel') total += 1200;
    if (configurationData.brakeControl === 'wireless') total += 299;
    
    // Add shipping cost
    const distance = unitDistances.get(selectedRV.stock);
    const shippingCost = configurationData.deliveryMethod === 'ship' && distance ? calculateShippingCost(distance) : 0;
    total += shippingCost;
    
    // Add protection costs
    const protectionCost = calculateOwnershipProtectionTotal();
    total += protectionCost;
    
    // Sales prep cost is now included (not added to total)
    
    return total;
  };

  const getFullLocationName = (unit: RV) => {
    // Try to find location by cmfId first
    if (unit.cmfId) {
      const locationData = locations.find(loc => loc.cmf === unit.cmfId);
      if (locationData) {
        return locationData.storename;
      }
    }
    // Fall back to the location string if available
    return unit.location || 'Location TBD';
  };

  const calculateDistancesToUnits = async (zipCode: string) => {
    if (!zipCode || zipCode.length !== 5) return;
    if (availableUnits.length === 0) return;
    
    setIsCalculatingDistances(true);
    
    try {
      // Get unique locations from available units with coordinates
      const uniqueLocations = new Map<number, LocationWithCoordinates>();
      
      availableUnits.forEach(unit => {
        if (unit.cmfId) {
          const locationData = locations.find(loc => loc.cmf === unit.cmfId);
          if (locationData && locationData.latitude && locationData.longitude && !uniqueLocations.has(unit.cmfId)) {
            uniqueLocations.set(unit.cmfId, {
              locationId: unit.cmfId.toString(),
              latitude: locationData.latitude,
              longitude: locationData.longitude
            });
          }
        }
      });

      if (uniqueLocations.size === 0) {
        console.log('No locations with coordinates found');
        setIsCalculatingDistances(false);
        return;
      }

      // Calculate distances using the batch API
      const locationArray = Array.from(uniqueLocations.values());
      const distances = await calculateDrivingDistances(zipCode, locationArray);
      
      // Map distances to each unit by their cmfId
      const unitDistanceMap = new Map<string, number>();
      availableUnits.forEach(unit => {
        if (unit.cmfId) {
          const distance = distances[unit.cmfId.toString()];
          if (distance !== undefined) {
            unitDistanceMap.set(unit.stock, distance);
          }
        }
      });
      
      setUnitDistances(unitDistanceMap);
    } catch (error) {
      console.error('Error calculating distances to units:', error);
    } finally {
      setIsCalculatingDistances(false);
    }
  };

  const handleStockSelection = (stock: string) => {
    const unit = availableUnits.find(u => u.stock === stock);
    if (unit) {
      setSelectedRV(unit);
      setConfigurationData(prev => ({
        ...prev,
        selectedStock: stock
      }));
    }
  };

  const isConfigurationValid = () => {
    // Check customer information
    if (!contactData.firstName.trim() || !contactData.lastName.trim() || 
        !contactData.email.trim() || !contactData.email.includes('@') ||
        !contactData.phone.trim() || contactData.phone.replace(/\D/g, '').length !== 10 ||
        !contactData.address.trim() || !contactData.city.trim() || 
        !contactData.state.trim() || !contactData.zipCode.trim() || 
        contactData.zipCode.length !== 5) {
      return false;
    }

    // Check stock selection
    if (!configurationData.selectedStock) {
      return false;
    }

    // Check ownership protection opt-out
    const hasAnyProtection = Object.values(configurationData.ownershipProtection).some(selected => selected);
    if (!hasAnyProtection && !protectionOptOut) {
      return false;
    }

    // Check shipping address if Ship To is selected
    if (configurationData.deliveryMethod === 'ship') {
      if (!configurationData.shippingAddressSameAsCustomer) {
        if (!configurationData.shippingAddress?.trim() || 
            !configurationData.shippingCity?.trim() || 
            !configurationData.shippingState?.trim() || 
            !configurationData.shippingZipCode?.trim() || 
            configurationData.shippingZipCode.length !== 5) {
          return false;
        }
      }
    }

    return true;
  };

  const handleNext = () => {
    if (currentStep === 'configuration') {
      // Validate customer information
      if (!contactData.firstName.trim()) {
        alert('Please enter your first name.');
        return;
      }
      if (!contactData.lastName.trim()) {
        alert('Please enter your last name.');
        return;
      }
      if (!contactData.email.trim() || !contactData.email.includes('@')) {
        alert('Please enter a valid email address.');
        return;
      }
      const phoneDigits = contactData.phone.replace(/\D/g, '');
      if (!contactData.phone.trim() || phoneDigits.length !== 10) {
        alert('Please enter a valid 10-digit phone number.');
        return;
      }
      if (!contactData.address.trim()) {
        alert('Please enter your street address.');
        return;
      }
      if (!contactData.city.trim()) {
        alert('Please enter your city.');
        return;
      }
      if (!contactData.state.trim()) {
        alert('Please select your state.');
        return;
      }
      if (!contactData.zipCode.trim() || contactData.zipCode.length !== 5) {
        alert('Please enter a valid 5-digit ZIP code.');
        return;
      }
      
      // Validate stock selection
      if (!configurationData.selectedStock) {
        alert('Please select a specific unit.');
        return;
      }

      // Validate ownership protection opt-out
      const hasAnyProtection = Object.values(configurationData.ownershipProtection).some(selected => selected);
      if (!hasAnyProtection && !protectionOptOut) {
        alert('Please either select at least one Ownership Protection plan or acknowledge that you are declining all coverage by checking the opt-out box.');
        return;
      }
      
      // Validate shipping address if Ship To is selected
      if (configurationData.deliveryMethod === 'ship') {
        // If checkbox is checked, copy customer address to shipping address
        if (configurationData.shippingAddressSameAsCustomer) {
          setConfigurationData(prev => ({
            ...prev,
            shippingAddress: contactData.address,
            shippingCity: contactData.city,
            shippingState: contactData.state,
            shippingZipCode: contactData.zipCode,
          }));
        } else {
          // Validate separate shipping address
          if (!configurationData.shippingAddress?.trim()) {
            alert('Please enter your shipping address.');
            return;
          }
          if (!configurationData.shippingCity?.trim()) {
            alert('Please enter your shipping city.');
            return;
          }
          if (!configurationData.shippingState?.trim()) {
            alert('Please enter your shipping state.');
            return;
          }
          if (!configurationData.shippingZipCode?.trim() || configurationData.shippingZipCode.length !== 5) {
            alert('Please enter a valid 5-digit ZIP code for shipping.');
            return;
          }
        }
      }
      
      setCurrentStep('review');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (currentStep === 'contact') {
      // Validate contact information
      if (!contactData.firstName.trim()) {
        alert('Please enter your first name.');
        return;
      }
      if (!contactData.lastName.trim()) {
        alert('Please enter your last name.');
        return;
      }
      if (!contactData.email.trim() || !contactData.email.includes('@')) {
        alert('Please enter a valid email address.');
        return;
      }
      const phoneDigits = contactData.phone.replace(/\D/g, '');
      if (!contactData.phone.trim() || phoneDigits.length !== 10) {
        alert('Please enter a valid 10-digit phone number.');
        return;
      }
      if (!contactData.address.trim()) {
        alert('Please enter your street address.');
        return;
      }
      if (!contactData.city.trim()) {
        alert('Please enter your city.');
        return;
      }
      if (!contactData.state.trim()) {
        alert('Please select your state.');
        return;
      }
      if (!contactData.zipCode.trim() || contactData.zipCode.length !== 5) {
        alert('Please enter a valid 5-digit ZIP code.');
        return;
      }
      setCurrentStep('review');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep === 'review') {
      setCurrentStep('configuration');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    setShowSignatureModal(true);
  };

  const handleSignatureSubmit = async () => {
    setIsSubmitting(true);
    // Simulate API call to create deal
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // In production, this would create a new deal in the database
    console.log('Purchase initiated:', {
      userEmail,
      modelSlug,
      rvId: selectedRV?.id,
      stock: configurationData.selectedStock,
      configurationData,
      totalPrice: calculateTotalPrice(),
    });

    // Redirect to confirmation page with order details
    const params = new URLSearchParams({
      rvName: selectedRV?.name || '',
      stock: configurationData.selectedStock || '',
      totalPrice: calculateTotalPrice().toString(),
      paymentMethod: configurationData.paymentMethod,
      deliveryMethod: configurationData.deliveryMethod,
      customerName: `${contactData.firstName} ${contactData.lastName}`,
      customerEmail: contactData.email,
      customerPhone: contactData.phone,
    });
    
    router.push(`/portal/purchase/${modelSlug}/confirmation?${params.toString()}`);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const getStepProgress = () => {
    const steps: Step[] = ['configuration', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };

  if (!selectedRV || availableUnits.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading model details...</div>
      </div>
    );
  }

  const discountedPrice = calculateDiscountedPrice(selectedRV.price);

  return (
    <>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
        strategy="beforeInteractive"
        onLoad={() => setIsGoogleMapsLoaded(true)}
      />
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Image
                src="/Kiewit-Logo.png"
                alt="Kiewit Logo"
                width={80}
                height={40}
                className="object-contain"
              />
              <div className="border-l border-gray-300 pl-4">
                <h1 className="text-2xl font-bold text-gray-900">Start Your Purchase</h1>
                <p className="text-sm text-gray-600 mt-0.5">{selectedRV.name}</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/portal')}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ← Back to Portal
            </button>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="mb-2">
            <div className="flex justify-between text-sm font-semibold">
              <span className={currentStep === 'configuration' ? 'text-blue-600' : 'text-gray-500'}>
                Configuration
              </span>
              <span className={currentStep === 'review' ? 'text-blue-600' : 'text-gray-500'}>
                Review & Submit
              </span>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${getStepProgress()}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          {/* RV Summary */}
          <div className="mb-8 pb-6 border-b border-gray-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">{selectedRV.name}</h2>
                <p className="text-gray-600 mt-1">
                  {selectedRV.year} {selectedRV.make} • {availableUnits.length} unit{availableUnits.length > 1 ? 's' : ''} available
                </p>
                {/* RV Thumbnail */}
                {getPrimaryImage(selectedRV.stock) && (
                  <div className="mt-3">
                    <img
                      src={getPrimaryImage(selectedRV.stock)}
                      alt={selectedRV.name}
                      className="w-48 h-36 rounded-lg border border-gray-200 object-cover"
                    />
                  </div>
                )}
              </div>
              <div className="text-right ml-4">
                <p className="text-sm text-gray-600 mb-1">Kiewit Employee Price</p>
                <p className="text-3xl font-bold text-blue-600">
                  {formatCurrency(discountedPrice)}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  or {formatCurrency(calculateMonthlyPayment(discountedPrice))}/mo
                </p>
                <p className="text-sm text-gray-500 line-through mt-2">
                  {formatCurrency(selectedRV.price)}
                </p>
                <p className="text-xs text-green-600 font-semibold mt-1">
                  Save {formatCurrency(selectedRV.price - discountedPrice)} (15% off MSRP)
                </p>
              </div>
            </div>
          </div>

          {/* Configuration Step */}
          {currentStep === 'configuration' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-6">
                  Configure Your RV
                </h3>
                <p className="text-gray-600 mb-6">
                  Select your delivery method and specific unit
                </p>
              </div>

              {/* Customer Information */}
              <div className="mb-8 pb-8 border-b border-gray-200">
                <h4 className="text-xl font-bold text-gray-800 mb-6">Customer Information</h4>
                
                {/* Name Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* First Name */}
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-semibold text-gray-700 mb-2">
                      First Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      value={contactData.firstName}
                      onChange={(e) => setContactData({ ...contactData, firstName: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 text-gray-800"
                      placeholder="First Name"
                    />
                  </div>

                  {/* Last Name */}
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-semibold text-gray-700 mb-2">
                      Last Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      value={contactData.lastName}
                      onChange={(e) => setContactData({ ...contactData, lastName: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 text-gray-800"
                      placeholder="Last Name"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="mb-4">
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={contactData.email}
                    onChange={(e) => setContactData({ ...contactData, email: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 text-gray-800"
                    placeholder="your.email@example.com"
                  />
                </div>

                {/* Phone */}
                <div className="mb-4">
                  <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number <span className="text-red-600">*</span>
                  </label>
                  <PatternFormat
                    id="phone"
                    format="(###) ###-####"
                    mask="_"
                    value={contactData.phone}
                    onValueChange={(values) => setContactData({ ...contactData, phone: values.formattedValue })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 text-gray-800"
                    placeholder="(555) 123-4567"
                  />
                </div>

                {/* Address */}
                <div className="mb-4">
                  <label htmlFor="address" className="block text-sm font-semibold text-gray-700 mb-2">
                    Street Address <span className="text-red-600">*</span>
                  </label>
                  {isGoogleMapsLoaded ? (
                    <Autocomplete
                      onPlaceSelected={(place) => {
                        if (!place) return;
                        const address = place.formatted_address || '';
                        setContactData({ ...contactData, address });
                        
                        // Try to extract city, state, zip from place
                        const components = place.address_components || [];
                        components.forEach((component: any) => {
                          if (component.types.includes('locality')) {
                            setContactData(prev => ({ ...prev, city: component.long_name }));
                          }
                          if (component.types.includes('administrative_area_level_1')) {
                            setContactData(prev => ({ ...prev, state: component.short_name }));
                          }
                          if (component.types.includes('postal_code')) {
                            setContactData(prev => ({ ...prev, zipCode: component.long_name }));
                          }
                        });
                      }}
                      options={{
                        types: ['address'],
                        componentRestrictions: { country: 'us' },
                      }}
                      defaultValue={contactData.address}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 text-gray-800"
                      placeholder="Start typing your address..."
                    />
                  ) : (
                    <input
                      type="text"
                      id="address"
                      value={contactData.address}
                      onChange={(e) => setContactData({ ...contactData, address: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 text-gray-800 bg-gray-50"
                      placeholder="Loading address autocomplete..."
                      disabled
                    />
                  )}
                </div>

                {/* City, State, Zip Code Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* City */}
                  <div>
                    <label htmlFor="city" className="block text-sm font-semibold text-gray-700 mb-2">
                      City <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      id="city"
                      value={contactData.city}
                      onChange={(e) => setContactData({ ...contactData, city: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 text-gray-800"
                      placeholder="City"
                    />
                  </div>

                  {/* State */}
                  <div>
                    <label htmlFor="state" className="block text-sm font-semibold text-gray-700 mb-2">
                      State <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      id="state"
                      value={contactData.state}
                      onChange={(e) => setContactData({ ...contactData, state: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 text-gray-800"
                      placeholder="State"
                      maxLength={2}
                    />
                  </div>

                  {/* Zip Code */}
                  <div>
                    <label htmlFor="zipCode" className="block text-sm font-semibold text-gray-700 mb-2">
                      Zip Code <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      id="zipCode"
                      value={contactData.zipCode}
                      onChange={(e) => setContactData({ ...contactData, zipCode: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 text-gray-800"
                      placeholder="Zip Code"
                      maxLength={5}
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Method Toggle */}
              <div className="mb-8">
                <label className="block text-xl font-bold text-gray-800 mb-4">Delivery Method</label>
                <div className="inline-flex rounded-lg border-2 border-gray-300 overflow-hidden">
                  <button
                    onClick={() => setConfigurationData({ ...configurationData, deliveryMethod: 'pickup' })}
                    className={`px-8 py-3 font-semibold transition-colors ${
                      configurationData.deliveryMethod === 'pickup'
                        ? 'bg-slate-700 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Pick Up
                  </button>
                  <button
                    onClick={() => {
                      setConfigurationData({ ...configurationData, deliveryMethod: 'ship' });
                      // Auto-select first unit if nothing is selected
                      if (!configurationData.selectedStock && sortedUnits.length > 0) {
                        handleStockSelection(sortedUnits[0].stock);
                      }
                    }}
                    className={`px-8 py-3 font-semibold transition-colors ${
                      configurationData.deliveryMethod === 'ship'
                        ? 'bg-slate-700 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Ship To
                  </button>
                </div>
              </div>

                {/* Shipping Address Checkbox - Only show if Ship To is selected */}
                {configurationData.deliveryMethod === 'ship' && (
                  <div className="mb-8">
                    <div className="flex items-start mb-4">
                      <input
                        type="checkbox"
                        id="sameAsCustomer"
                        checked={configurationData.shippingAddressSameAsCustomer}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setConfigurationData({ 
                            ...configurationData, 
                            shippingAddressSameAsCustomer: isChecked,
                            // If checked, copy customer address to shipping address
                            ...(isChecked ? {
                              shippingAddress: contactData.address,
                              shippingCity: contactData.city,
                              shippingState: contactData.state,
                              shippingZipCode: contactData.zipCode,
                            } : {})
                          });
                        }}
                        className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="sameAsCustomer" className="ml-3 text-sm font-medium text-gray-700">
                        Shipping address is the same as my customer address
                      </label>
                    </div>

                    {/* Conditional Shipping Address Form - Only show if checkbox is unchecked */}
                    {!configurationData.shippingAddressSameAsCustomer && (
                      <div className="space-y-4 pl-0">
                        <div>
                          <label className="block text-xl font-bold text-gray-800 mb-4">
                            Shipping Address <span className="text-red-600">*</span>
                          </label>
                          <p className="text-sm text-gray-600 mb-3">
                            Enter the address where you'd like the RV delivered
                          </p>
                        </div>

                        {/* Street Address with Google Autocomplete */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Street Address <span className="text-red-600">*</span>
                          </label>
                          <Autocomplete
                            apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                            onPlaceSelected={(place) => {
                              const address = place.formatted_address || '';
                              setConfigurationData(prev => ({ ...prev, shippingAddress: address }));
                              
                              // Extract city, state, zip from place
                              const components = place.address_components || [];
                              components.forEach((component: any) => {
                                if (component.types.includes('locality')) {
                                  setConfigurationData(prev => ({ ...prev, shippingCity: component.long_name }));
                                }
                                if (component.types.includes('administrative_area_level_1')) {
                                  setConfigurationData(prev => ({ ...prev, shippingState: component.short_name }));
                                }
                                if (component.types.includes('postal_code')) {
                                  setConfigurationData(prev => ({ ...prev, shippingZipCode: component.long_name }));
                                }
                              });
                            }}
                            options={{
                              types: ['address'],
                              componentRestrictions: { country: 'us' },
                            }}
                            defaultValue={configurationData.shippingAddress || ''}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 text-gray-800"
                            placeholder="Start typing your address..."
                          />
                        </div>

                        {/* City, State, Zip Row */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* City */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              City <span className="text-red-600">*</span>
                            </label>
                            <input
                              type="text"
                              value={configurationData.shippingCity || ''}
                              onChange={(e) => setConfigurationData({ ...configurationData, shippingCity: e.target.value })}
                              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 text-gray-800"
                              placeholder="City"
                            />
                          </div>

                          {/* State */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              State <span className="text-red-600">*</span>
                            </label>
                            <input
                              type="text"
                              value={configurationData.shippingState || ''}
                              onChange={(e) => setConfigurationData({ ...configurationData, shippingState: e.target.value })}
                              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 text-gray-800"
                              placeholder="State"
                              maxLength={2}
                            />
                          </div>

                          {/* Zip Code */}
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Zip Code <span className="text-red-600">*</span>
                            </label>
                            <input
                              type="text"
                              value={configurationData.shippingZipCode || ''}
                              onChange={(e) => setConfigurationData({ ...configurationData, shippingZipCode: e.target.value })}
                              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 text-gray-800"
                              placeholder="Zip Code"
                              maxLength={5}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Unit Selection - Only show if multiple units available */}
                {availableUnits.length > 1 && (
                  <div className="mb-8">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <label className="block text-xl font-bold text-gray-800 mb-2">
                          Select Specific Unit <span className="text-red-600">*</span>
                        </label>
                        <p className="text-sm text-gray-600">
                          We have {availableUnits.length} units of this model available. Please select your preferred unit:
                        </p>
                      </div>
                      
                      {/* Sort By Dropdown */}
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">Sort by:</label>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as 'distance' | 'price')}
                          className="px-3 py-2 border-2 border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:border-blue-600"
                        >
                          {configurationData.deliveryMethod === 'pickup' && unitDistances.size > 0 && (
                            <option value="distance">Distance</option>
                          )}
                          <option value="price">Price</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {sortedUnits.map((unit) => {
                        const discountedPrice = calculateDiscountedPrice(unit.price);
                        const monthlyPayment = calculateMonthlyPayment(discountedPrice);
                        const distance = unitDistances.get(unit.stock);
                        const showDistance = distance !== undefined;
                        const isShipTo = configurationData.deliveryMethod === 'ship';
                        
                        // Calculate shipping costs if ship-to is selected and distance is available
                        const shippingCost = isShipTo && distance ? calculateShippingCost(distance) : 0;
                        const shippingMonthly = shippingCost > 0 ? calculateShippingMonthlyPayment(shippingCost) : 0;
                        
                        // Calculate grand total if shipping
                        const grandTotal = isShipTo && shippingCost > 0 ? discountedPrice + shippingCost : discountedPrice;
                        const grandTotalMonthly = calculateMonthlyPayment(grandTotal);
                        
                        return (
                          <button
                            key={unit.stock}
                            onClick={() => handleStockSelection(unit.stock)}
                            className={`w-full text-left p-4 border-2 rounded-lg transition-all ${
                              configurationData.selectedStock === unit.stock
                                ? 'border-blue-600 bg-blue-50'
                                : 'border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-semibold text-gray-900">Stock #{unit.stock}</p>
                                <p className="text-sm text-gray-600">{getFullLocationName(unit)}</p>
                                
                                {/* Show distance for both pickup and ship-to */}
                                {showDistance && (
                                  <p className="text-sm text-blue-600 font-medium mt-1">
                                    📍 {distance.toFixed(0)} miles away
                                  </p>
                                )}
                                
                                {isCalculatingDistances && !distance && (
                                  <p className="text-xs text-gray-500 mt-1">Calculating distance...</p>
                                )}
                              </div>
                              
                              {/* Pricing Section */}
                              <div className="ml-4 min-w-[320px]">
                                {/* Top row - Shipping (if ship-to) + RV Price */}
                                <div className="flex items-start justify-center gap-6 mb-2">
                                  {/* Shipping Cost - LEFT (only show for ship-to) */}
                                  {isShipTo && shippingCost > 0 && (
                                    <>
                                      <div className="text-center">
                                        <p className="text-xs text-gray-500 mb-1">Shipping</p>
                                        <p className="font-semibold text-blue-600 text-lg">{formatCurrency(shippingCost)}</p>
                                        <p className="text-xs text-gray-600 mt-1">or {formatCurrency(shippingMonthly)}/mo</p>
                                      </div>
                                      
                                      {/* Plus Sign - Centered */}
                                      <div className="text-2xl font-bold text-gray-600 flex items-center">+</div>
                                    </>
                                  )}
                                  
                                  {/* RV Price - RIGHT (always in same position) */}
                                  <div className="text-center">
                                    <p className="text-xs text-gray-500 mb-1">RV Price</p>
                                    <p className="font-semibold text-blue-600 text-lg">{formatCurrency(discountedPrice)}</p>
                                    <p className="text-xs text-gray-600 mt-1">or {formatCurrency(monthlyPayment)}/mo</p>
                                    <p className="text-xs text-gray-500 mt-1">MSRP: {formatCurrency(unit.price)}</p>
                                  </div>
                                </div>
                                
                                {/* Grand Total - Only show for ship-to */}
                                {isShipTo && shippingCost > 0 && (
                                  <>
                                    {/* Equals Line */}
                                    <div className="border-t-2 border-gray-400 my-2"></div>
                                    
                                    {/* Grand Total - BELOW */}
                                    <div className="text-center">
                                      <p className="text-xs text-gray-700 font-semibold mb-1">Grand Total</p>
                                      <p className="font-bold text-green-600 text-xl">{formatCurrency(grandTotal)}</p>
                                      <p className="text-xs text-gray-600 mt-1">or {formatCurrency(grandTotalMonthly)}/mo</p>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Accessories Selection */}
                <div className="mb-8 pb-8 pt-8 border-t border-gray-200 border-b">
                  <label className="block text-xl font-bold text-gray-800 mb-4">Optional Accessories</label>
                  <p className="text-gray-600 mb-6">Add accessories to enhance your RV experience</p>

                  {/* Power Package */}
                  <div className="mb-6">
                    <label className="block text-lg font-semibold text-gray-700 mb-3">Power Package</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <button
                        onClick={() => setConfigurationData({ ...configurationData, powerPackage: 'standard' })}
                        className={`p-4 border-2 rounded-lg transition-all text-left ${
                          configurationData.powerPackage === 'standard'
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <div className="font-semibold text-gray-900">🔋 2 Standard RV Batteries</div>
                        <div className="text-sm text-gray-600 mb-1">$419 total</div>
                        <div className="text-blue-600 font-semibold">+{formatCurrency(419)}</div>
                        <div className="text-xs text-gray-500">or +{formatCurrency(Math.round(419 / 120))}/mo</div>
                      </button>
                      
                      <button
                        onClick={() => setConfigurationData({ ...configurationData, powerPackage: '6volt' })}
                        className={`p-4 border-2 rounded-lg transition-all text-left ${
                          configurationData.powerPackage === '6volt'
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <div className="font-semibold text-gray-900">🔋 2 6 Volt RV Batteries</div>
                        <div className="text-sm text-gray-600 mb-1">$555 total</div>
                        <div className="text-blue-600 font-semibold">+{formatCurrency(555)}</div>
                        <div className="text-xs text-gray-500">or +{formatCurrency(Math.round(555 / 120))}/mo</div>
                      </button>
                      
                      <button
                        onClick={() => setConfigurationData({ ...configurationData, powerPackage: 'lithium' })}
                        className={`p-4 border-2 rounded-lg transition-all text-left ${
                          configurationData.powerPackage === 'lithium'
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <div className="font-semibold text-gray-900">⚡ 2 Upgraded Lithium RV Batteries</div>
                        <div className="text-sm text-gray-600 mb-1">$1,299 total</div>
                        <div className="text-blue-600 font-semibold">+{formatCurrency(1299)}</div>
                        <div className="text-xs text-gray-500">or +{formatCurrency(Math.round(1299 / 120))}/mo</div>
                      </button>
                    </div>
                  </div>

                  {/* Hitch Package */}
                  <div className="mb-6">
                    <label className="block text-lg font-semibold text-gray-700 mb-3">Hitch Package</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <button
                        onClick={() => setConfigurationData({ ...configurationData, hitchPackage: undefined })}
                        className={`p-4 border-2 rounded-lg transition-all text-left ${
                          !configurationData.hitchPackage
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <div className="font-semibold text-gray-900">None</div>
                        <div className="text-sm text-gray-600">Standard Configuration</div>
                      </button>
                      
                      {selectedRV.type === 'FW' ? (
                        <button
                          onClick={() => setConfigurationData({ ...configurationData, hitchPackage: 'fifth-wheel' })}
                          className={`p-4 border-2 rounded-lg transition-all text-left ${
                            configurationData.hitchPackage === 'fifth-wheel'
                              ? 'border-blue-600 bg-blue-50'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <div className="font-semibold text-gray-900">🔗 5th Wheel Hitch Installation</div>
                          <div className="text-sm text-gray-600 mb-1">Professional installation in truck bed</div>
                          <div className="text-blue-600 font-semibold">+{formatCurrency(1200)}</div>
                          <div className="text-xs text-gray-500">or +{formatCurrency(Math.round(1200 / 120))}/mo</div>
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfigurationData({ ...configurationData, hitchPackage: 'anti-sway' })}
                          className={`p-4 border-2 rounded-lg transition-all text-left ${
                            configurationData.hitchPackage === 'anti-sway'
                              ? 'border-blue-600 bg-blue-50'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <div className="font-semibold text-gray-900">🔗 Anti-Sway Hitch</div>
                          <div className="text-sm text-gray-600 mb-1">Enhanced stability and control</div>
                          <div className="text-blue-600 font-semibold">+{formatCurrency(600)}</div>
                          <div className="text-xs text-gray-500">or +{formatCurrency(Math.round(600 / 120))}/mo</div>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Brake Control */}
                  <div className="mb-6">
                    <label className="block text-lg font-semibold text-gray-700 mb-3">Brake Controller</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <button
                        onClick={() => setConfigurationData({ ...configurationData, brakeControl: undefined })}
                        className={`p-4 border-2 rounded-lg transition-all text-left ${
                          !configurationData.brakeControl
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <div className="font-semibold text-gray-900">None</div>
                        <div className="text-sm text-gray-600">No brake controller</div>
                      </button>
                      
                      <button
                        onClick={() => setConfigurationData({ ...configurationData, brakeControl: 'wireless' })}
                        className={`p-4 border-2 rounded-lg transition-all text-left ${
                          configurationData.brakeControl === 'wireless'
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <div className="font-semibold text-gray-900">🛑 Wireless Brake Controller</div>
                        <div className="text-sm text-gray-600 mb-1">Easy installation, remote control</div>
                        <div className="text-blue-600 font-semibold">+{formatCurrency(299)}</div>
                        <div className="text-xs text-gray-500">or +{formatCurrency(Math.round(299 / 120))}/mo</div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Financing Information - Auto-selected */}
                <div className="mb-8">
                  {selectedRV && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-900 mb-2">
                        <strong>Kiewit Financing Benefits:</strong>
                      </p>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• 0% APR for 120 months (10 years)</li>
                        <li>• 20% down payment required</li>
                        <li>• Estimated monthly payment: <strong>{formatCurrency((() => {
                          const discountedPrice = calculateDiscountedPrice(selectedRV.price);
                          const distance = unitDistances.get(selectedRV.stock);
                          const shippingCost = configurationData.deliveryMethod === 'ship' && distance ? calculateShippingCost(distance) : 0;
                          const grandTotal = discountedPrice + shippingCost;
                          return calculateMonthlyPayment(grandTotal);
                        })())}/mo</strong></li>
                      </ul>
                    </div>
                  )}
                </div>

                {/* Ownership Protection Section */}
                <div className="mb-8 pt-8 border-t border-gray-200">
                  <label className="block text-xl font-bold text-gray-800 mb-4">Ownership Protection</label>
                  <p className="text-gray-600 mb-4">Protect your investment with these optional coverage plans</p>
                  
                  <div className="space-y-3">
                    {/* Extended Service Contract */}
                    <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
                      <label className="flex items-start p-4 hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={configurationData.ownershipProtection.extendedServiceContract}
                          onChange={(e) => setConfigurationData({
                            ...configurationData,
                            ownershipProtection: {
                              ...configurationData.ownershipProtection,
                              extendedServiceContract: e.target.checked
                            }
                          })}
                          className="mt-1 h-5 w-5 text-[#B43732] focus:ring-[#B43732] rounded"
                        />
                        <div className="ml-3 flex-1">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">Extended Service Contract</p>
                              <p className="text-sm text-gray-600">Comprehensive coverage for major systems and components beyond manufacturer warranty</p>
                            </div>
                            <div className="text-right ml-4 flex-shrink-0">
                              <p className="font-bold text-gray-900">{formatCurrency(OWNERSHIP_PROTECTION_PRICES.extendedServiceContract)}</p>
                              {configurationData.paymentMethod === 'finance' && (
                                <p className="text-sm text-gray-600">{formatCurrency(OWNERSHIP_PROTECTION_PRICES.extendedServiceContract / 120)}/mo</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setExpandedProtection(expandedProtection === 'extendedServiceContract' ? null : 'extendedServiceContract');
                          }}
                          className="ml-3 text-gray-400 hover:text-gray-600"
                        >
                          <svg className={`w-5 h-5 transition-transform ${expandedProtection === 'extendedServiceContract' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </label>
                      {expandedProtection === 'extendedServiceContract' && (
                        <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-200">
                          <p className="text-sm font-semibold text-gray-900 mb-2">What it is:</p>
                          <p className="text-sm text-gray-700 mb-3">A mechanical breakdown policy that kicks in after the manufacturer's warranty expires (or covers items the manufacturer doesn't).</p>
                          <p className="text-sm font-semibold text-gray-900 mb-2">Why consider it:</p>
                          <p className="text-sm text-gray-700">RVs are "rolling earthquakes"—they undergo a lot of stress on the road. Repairing slide-outs, leveling systems, refrigerators, or A/C units can cost thousands. This contract locks in your repair costs to a small deductible, protecting your travel budget from surprise bills.</p>
                        </div>
                      )}
                    </div>

                    {/* Paint & Fabric Protection */}
                    <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
                      <label className="flex items-start p-4 hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={configurationData.ownershipProtection.paintAndFabric}
                          onChange={(e) => setConfigurationData({
                            ...configurationData,
                            ownershipProtection: {
                              ...configurationData.ownershipProtection,
                              paintAndFabric: e.target.checked
                            }
                          })}
                          className="mt-1 h-5 w-5 text-[#B43732] focus:ring-[#B43732] rounded"
                        />
                        <div className="ml-3 flex-1">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">Paint & Fabric Protection</p>
                              <p className="text-sm text-gray-600">Guards against stains, fading, and damage to interior and exterior surfaces</p>
                            </div>
                            <div className="text-right ml-4 flex-shrink-0">
                              <p className="font-bold text-gray-900">{formatCurrency(OWNERSHIP_PROTECTION_PRICES.paintAndFabric)}</p>
                              {configurationData.paymentMethod === 'finance' && (
                                <p className="text-sm text-gray-600">{formatCurrency(OWNERSHIP_PROTECTION_PRICES.paintAndFabric / 120)}/mo</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setExpandedProtection(expandedProtection === 'paintAndFabric' ? null : 'paintAndFabric');
                          }}
                          className="ml-3 text-gray-400 hover:text-gray-600"
                        >
                          <svg className={`w-5 h-5 transition-transform ${expandedProtection === 'paintAndFabric' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </label>
                      {expandedProtection === 'paintAndFabric' && (
                        <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-200">
                          <p className="text-sm font-semibold text-gray-900 mb-2">What it is:</p>
                          <p className="text-sm text-gray-700 mb-3">A chemical sealant applied to the exterior fiberglass/paint and the interior fabrics/leathers.</p>
                          <p className="text-sm font-semibold text-gray-900 mb-2">Why consider it:</p>
                          <p className="text-sm text-gray-700 mb-2"><strong>Exterior:</strong> RVs sit outside in the elements. This protects the finish from UV fading, oxidation (chalkiness), bird droppings, and tree sap. It often eliminates the need for waxing for several years.</p>
                          <p className="text-sm text-gray-700"><strong>Interior:</strong> It seals the fibers of your cushions and carpet, preventing stains from spills (coffee, juice, mud) from setting in permanently.</p>
                        </div>
                      )}
                    </div>

                    {/* Tire & Wheel Protection */}
                    <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
                      <label className="flex items-start p-4 hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={configurationData.ownershipProtection.tireAndWheel}
                          onChange={(e) => setConfigurationData({
                            ...configurationData,
                            ownershipProtection: {
                              ...configurationData.ownershipProtection,
                              tireAndWheel: e.target.checked
                            }
                          })}
                          className="mt-1 h-5 w-5 text-[#B43732] focus:ring-[#B43732] rounded"
                        />
                        <div className="ml-3 flex-1">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">Tire & Wheel Protection</p>
                              <p className="text-sm text-gray-600">Covers repair or replacement costs from road hazard damage</p>
                            </div>
                            <div className="text-right ml-4 flex-shrink-0">
                              <p className="font-bold text-gray-900">{formatCurrency(OWNERSHIP_PROTECTION_PRICES.tireAndWheel)}</p>
                              {configurationData.paymentMethod === 'finance' && (
                                <p className="text-sm text-gray-600">{formatCurrency(OWNERSHIP_PROTECTION_PRICES.tireAndWheel / 120)}/mo</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setExpandedProtection(expandedProtection === 'tireAndWheel' ? null : 'tireAndWheel');
                          }}
                          className="ml-3 text-gray-400 hover:text-gray-600"
                        >
                          <svg className={`w-5 h-5 transition-transform ${expandedProtection === 'tireAndWheel' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </label>
                      {expandedProtection === 'tireAndWheel' && (
                        <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-200">
                          <p className="text-sm font-semibold text-gray-900 mb-2">What it is:</p>
                          <p className="text-sm text-gray-700 mb-3">Coverage that replaces or repairs tires and wheels damaged by road hazards like nails, potholes, or debris.</p>
                          <p className="text-sm font-semibold text-gray-900 mb-2">Why consider it:</p>
                          <p className="text-sm text-gray-700">RV tires are expensive ($400-600 each) and you have 4-6 of them. Road hazards are common when traveling. One incident can cost you thousands. This coverage ensures you're back on the road quickly without a major expense.</p>
                        </div>
                      )}
                    </div>

                    {/* Monster Seal Protection */}
                    <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
                      <label className="flex items-start p-4 hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={configurationData.ownershipProtection.monsterSeal}
                          onChange={(e) => setConfigurationData({
                            ...configurationData,
                            ownershipProtection: {
                              ...configurationData.ownershipProtection,
                              monsterSeal: e.target.checked
                            }
                          })}
                          className="mt-1 h-5 w-5 text-[#B43732] focus:ring-[#B43732] rounded"
                        />
                        <div className="ml-3 flex-1">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">Monster Seal Protection</p>
                              <p className="text-sm text-gray-600">Advanced sealant protection against leaks and water damage</p>
                            </div>
                            <div className="text-right ml-4 flex-shrink-0">
                              <p className="font-bold text-gray-900">{formatCurrency(OWNERSHIP_PROTECTION_PRICES.monsterSeal)}</p>
                              {configurationData.paymentMethod === 'finance' && (
                                <p className="text-sm text-gray-600">{formatCurrency(OWNERSHIP_PROTECTION_PRICES.monsterSeal / 120)}/mo</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setExpandedProtection(expandedProtection === 'monsterSeal' ? null : 'monsterSeal');
                          }}
                          className="ml-3 text-gray-400 hover:text-gray-600"
                        >
                          <svg className={`w-5 h-5 transition-transform ${expandedProtection === 'monsterSeal' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </label>
                      {expandedProtection === 'monsterSeal' && (
                        <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-200">
                          <p className="text-sm font-semibold text-gray-900 mb-2">What it is:</p>
                          <p className="text-sm text-gray-700 mb-3">A heavy-duty liquid gel injected into the tires that instantly seals punctures as they happen.</p>
                          <p className="text-sm font-semibold text-gray-900 mb-2">Why consider it:</p>
                          <p className="text-sm text-gray-700 mb-2">A blowout on an RV can be dangerous and incredibly stressful. This product proactively seals tread punctures (usually up to 1/2 inch) so you don't lose air pressure. It also helps maintain constant tire pressure, which can improve fuel economy and extend tire life.</p>
                          <p className="text-sm text-gray-600 italic">Note: This is often sold as a bundle with "Tire & Wheel Protection," which pays to replace tires or rims damaged by road hazards.</p>
                        </div>
                      )}
                    </div>

                    {/* GAP Protection */}
                    <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
                      <label className="flex items-start p-4 hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={configurationData.ownershipProtection.gap}
                          onChange={(e) => setConfigurationData({
                            ...configurationData,
                            ownershipProtection: {
                              ...configurationData.ownershipProtection,
                              gap: e.target.checked
                            }
                          })}
                          className="mt-1 h-5 w-5 text-[#B43732] focus:ring-[#B43732] rounded"
                        />
                        <div className="ml-3 flex-1">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">GAP Coverage</p>
                              <p className="text-sm text-gray-600">Covers the difference between insurance payout and loan balance in case of total loss</p>
                            </div>
                            <div className="text-right ml-4 flex-shrink-0">
                              <p className="font-bold text-gray-900">{formatCurrency(OWNERSHIP_PROTECTION_PRICES.gap)}</p>
                              {configurationData.paymentMethod === 'finance' && (
                                <p className="text-sm text-gray-600">{formatCurrency(OWNERSHIP_PROTECTION_PRICES.gap / 120)}/mo</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setExpandedProtection(expandedProtection === 'gap' ? null : 'gap');
                          }}
                          className="ml-3 text-gray-400 hover:text-gray-600"
                        >
                          <svg className={`w-5 h-5 transition-transform ${expandedProtection === 'gap' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </label>
                      {expandedProtection === 'gap' && (
                        <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-200">
                          <p className="text-sm font-semibold text-gray-900 mb-2">What it is:</p>
                          <p className="text-sm text-gray-700 mb-3">A financial safety net that covers the "gap" between what your insurance company pays out and what you still owe on your loan if your RV is stolen or totaled.</p>
                          <p className="text-sm font-semibold text-gray-900 mb-2">Why consider it:</p>
                          <p className="text-sm text-gray-700">RVs can depreciate quickly in the first few years. If your RV is totaled, your standard insurance only pays the current market value, which might be thousands of dollars less than your loan balance. GAP pays that difference so you aren't paying for an RV you no longer have.</p>
                        </div>
                      )}
                    </div>

                    {/* 5 Year Roadside Assistance */}
                    <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
                      <label className="flex items-start p-4 hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                        type="checkbox"
                        checked={configurationData.ownershipProtection.fiveYearRoadside}
                        onChange={(e) => setConfigurationData({
                          ...configurationData,
                          ownershipProtection: {
                            ...configurationData.ownershipProtection,
                            fiveYearRoadside: e.target.checked
                          }
                        })}
                        className="mt-1 ml-3 h-5 w-5 text-[#B43732] focus:ring-[#B43732] rounded"
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">5-Year Roadside Assistance</p>
                            <p className="text-sm text-gray-600">24/7 emergency roadside support including towing, fuel delivery, and tire changes</p>
                          </div>
                          <div className="text-right ml-4 flex-shrink-0">
                            <p className="font-bold text-gray-900">{formatCurrency(OWNERSHIP_PROTECTION_PRICES.fiveYearRoadside)}</p>
                            {configurationData.paymentMethod === 'finance' && (
                              <p className="text-sm text-gray-600">{formatCurrency(OWNERSHIP_PROTECTION_PRICES.fiveYearRoadside / 120)}/mo</p>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setExpandedProtection(expandedProtection === 'fiveYearRoadside' ? null : 'fiveYearRoadside');
                        }}
                        className="ml-3 text-gray-400 hover:text-gray-600"
                      >
                        <svg className={`w-5 h-5 transition-transform ${expandedProtection === 'fiveYearRoadside' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </label>
                    {expandedProtection === 'fiveYearRoadside' && (
                      <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-200">
                        <p className="text-sm font-semibold text-gray-900 mb-2">What it is:</p>
                        <p className="text-sm text-gray-700 mb-3">24/7 emergency roadside service including towing, fuel delivery, tire changes, lockout service, and battery jump-starts.</p>
                        <p className="text-sm font-semibold text-gray-900 mb-2">Why consider it:</p>
                        <p className="text-sm text-gray-700">RVs require specialized towing equipment and can cost $500-1,500+ per tow. Being stranded far from home can ruin a trip. This coverage gives you peace of mind knowing help is just a phone call away, anywhere in North America.</p>
                      </div>
                    )}
                  </div>

                    {/* RV Life Protection */}
                    <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
                      <label className="flex items-start p-4 hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={configurationData.ownershipProtection.rvLife}
                          onChange={(e) => setConfigurationData({
                            ...configurationData,
                            ownershipProtection: {
                              ...configurationData.ownershipProtection,
                              rvLife: e.target.checked
                            }
                          })}
                          className="mt-1 h-5 w-5 text-[#B43732] focus:ring-[#B43732] rounded"
                        />
                        <div className="ml-3 flex-1">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">RV Life Protection</p>
                              <p className="text-sm text-gray-600">Comprehensive lifestyle protection including trip interruption and vacation liability coverage</p>
                            </div>
                            <div className="text-right ml-4 flex-shrink-0">
                              <p className="font-bold text-gray-900">{formatCurrency(OWNERSHIP_PROTECTION_PRICES.rvLife)}</p>
                              {configurationData.paymentMethod === 'finance' && (
                                <p className="text-sm text-gray-600">{formatCurrency(OWNERSHIP_PROTECTION_PRICES.rvLife / 120)}/mo</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setExpandedProtection(expandedProtection === 'rvLife' ? null : 'rvLife');
                          }}
                          className="ml-3 text-gray-400 hover:text-gray-600"
                        >
                          <svg className={`w-5 h-5 transition-transform ${expandedProtection === 'rvLife' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </label>
                      {expandedProtection === 'rvLife' && (
                        <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-200">
                          <p className="text-sm font-semibold text-gray-900 mb-2">What it is:</p>
                          <p className="text-sm text-gray-700 mb-3">Comprehensive lifestyle coverage including trip interruption reimbursement, vacation liability, campground damage, and personal belongings coverage.</p>
                          <p className="text-sm font-semibold text-gray-900 mb-2">Why consider it:</p>
                          <p className="text-sm text-gray-700">Your RV is your mobile vacation home. If a breakdown forces you to cancel plans, you could lose non-refundable campground fees, event tickets, and lodging costs. This also protects you from liability if someone is injured at your campsite.</p>
                        </div>
                      )}
                    </div>

                    {/* Lifetime Battery Protection */}
                    <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
                      <label className="flex items-start p-4 hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={configurationData.ownershipProtection.lifetimeBattery}
                          onChange={(e) => setConfigurationData({
                            ...configurationData,
                            ownershipProtection: {
                              ...configurationData.ownershipProtection,
                              lifetimeBattery: e.target.checked
                            }
                          })}
                          className="mt-1 h-5 w-5 text-[#B43732] focus:ring-[#B43732] rounded"
                        />
                        <div className="ml-3 flex-1">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">Lifetime Battery Replacement</p>
                              <p className="text-sm text-gray-600">Free battery replacement for the life of your RV ownership</p>
                            </div>
                            <div className="text-right ml-4 flex-shrink-0">
                              <p className="font-bold text-gray-900">{formatCurrency(OWNERSHIP_PROTECTION_PRICES.lifetimeBattery)}</p>
                              {configurationData.paymentMethod === 'finance' && (
                                <p className="text-sm text-gray-600">{formatCurrency(OWNERSHIP_PROTECTION_PRICES.lifetimeBattery / 120)}/mo</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setExpandedProtection(expandedProtection === 'lifetimeBattery' ? null : 'lifetimeBattery');
                          }}
                          className="ml-3 text-gray-400 hover:text-gray-600"
                        >
                          <svg className={`w-5 h-5 transition-transform ${expandedProtection === 'lifetimeBattery' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </label>
                      {expandedProtection === 'lifetimeBattery' && (
                        <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-200">
                          <p className="text-sm font-semibold text-gray-900 mb-2">What it is:</p>
                          <p className="text-sm text-gray-700 mb-3">Free replacement of your RV's house batteries (deep cycle batteries) for as long as you own the RV.</p>
                          <p className="text-sm font-semibold text-gray-900 mb-2">Why consider it:</p>
                          <p className="text-sm text-gray-700">RV house batteries typically last 3-5 years and cost $200-400 each. Most RVs have 2-4 batteries. Over 10-15 years of ownership, you could spend $2,000+ on replacements. This one-time fee covers all future batteries.</p>
                        </div>
                      )}
                    </div>

                    {/* Roof Protection */}
                    <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
                      <label className="flex items-start p-4 hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={configurationData.ownershipProtection.roof}
                          onChange={(e) => setConfigurationData({
                            ...configurationData,
                            ownershipProtection: {
                              ...configurationData.ownershipProtection,
                              roof: e.target.checked
                            }
                          })}
                          className="mt-1 h-5 w-5 text-[#B43732] focus:ring-[#B43732] rounded"
                        />
                        <div className="ml-3 flex-1">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">Roof Protection Plan</p>
                              <p className="text-sm text-gray-600">Complete coverage for roof repairs and replacement due to leaks or weather damage</p>
                            </div>
                            <div className="text-right ml-4 flex-shrink-0">
                              <p className="font-bold text-gray-900">{formatCurrency(OWNERSHIP_PROTECTION_PRICES.roof)}</p>
                              {configurationData.paymentMethod === 'finance' && (
                                <p className="text-sm text-gray-600">{formatCurrency(OWNERSHIP_PROTECTION_PRICES.roof / 120)}/mo</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setExpandedProtection(expandedProtection === 'roof' ? null : 'roof');
                          }}
                          className="ml-3 text-gray-400 hover:text-gray-600"
                        >
                          <svg className={`w-5 h-5 transition-transform ${expandedProtection === 'roof' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </label>
                      {expandedProtection === 'roof' && (
                        <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-200">
                          <p className="text-sm font-semibold text-gray-900 mb-2">What it is:</p>
                          <p className="text-sm text-gray-700 mb-3">Complete coverage for roof repairs, resealing, and replacement due to leaks, weather damage, or seal failures.</p>
                          <p className="text-sm font-semibold text-gray-900 mb-2">Why consider it:</p>
                          <p className="text-sm text-gray-700">The roof is your RV's most vulnerable component. Water intrusion from roof leaks can cause $8,000-15,000 in structural damage. Regular maintenance and resealing costs add up. This plan covers repairs and preventative maintenance to keep your roof watertight.</p>
                        </div>
                      )}
                    </div>

                    {/* Opt-Out Acknowledgment - Only show if no protections are selected */}
                    {!Object.values(configurationData.ownershipProtection).some(selected => selected) && (
                      <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start">
                          <input
                            type="checkbox"
                            id="protectionOptOut"
                            checked={protectionOptOut}
                            onChange={(e) => setProtectionOptOut(e.target.checked)}
                            className="mt-0.5 h-4 w-4 text-[#B43732] focus:ring-[#B43732] rounded flex-shrink-0"
                          />
                          <label htmlFor="protectionOptOut" className="ml-3 flex-1 cursor-pointer">
                            <p className="text-sm font-semibold text-gray-900 mb-1">
                              I acknowledge that I am declining all Ownership Protection coverage
                            </p>
                            <p className="text-xs text-gray-700">
                              By checking this box, I understand I am solely responsible for all repair and maintenance costs, and that adding protection plans later may not be available or may cost more.
                            </p>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-6 border-t border-gray-200">
                <button
                  onClick={handleNext}
                  disabled={!isConfigurationValid()}
                  className={`px-8 py-3 font-semibold rounded-lg transition-colors ${
                    isConfigurationValid()
                      ? 'bg-[#B43732] text-white hover:bg-[#9A2F2B] cursor-pointer'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Next: Review →
                </button>
              </div>
            </div>
          )}

          {/* Contact Step */}
          {currentStep === 'contact' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-6">
                  Contact Information
                </h3>
                <p className="text-gray-600 mb-6">
                  Provide your contact details so Bish's RV can reach you
                </p>
              </div>

              {/* Name Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* First Name */}
                <div>
                  <label htmlFor="firstName" className="block text-xl font-bold text-gray-800 mb-4">
                    First Name
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    value={contactData.firstName}
                    onChange={(e) => setContactData({ ...contactData, firstName: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#B43732] text-gray-800"
                    placeholder="First Name"
                  />
                </div>

                {/* Last Name */}
                <div>
                  <label htmlFor="lastName" className="block text-xl font-bold text-gray-800 mb-4">
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    value={contactData.lastName}
                    onChange={(e) => setContactData({ ...contactData, lastName: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#B43732] text-gray-800"
                    placeholder="Last Name"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-xl font-bold text-gray-800 mb-4">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={contactData.email}
                  onChange={(e) => setContactData({ ...contactData, email: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#B43732] text-gray-800"
                  placeholder="your.email@example.com"
                />
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-xl font-bold text-gray-800 mb-4">
                  Phone Number
                </label>
                <PatternFormat
                  id="phone"
                  format="(###) ###-####"
                  mask="_"
                  value={contactData.phone}
                  onValueChange={(values) => setContactData({ ...contactData, phone: values.formattedValue })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#B43732] text-gray-800"
                  placeholder="(555) 123-4567"
                />
              </div>

              {/* Address */}
              <div>
                <label htmlFor="address" className="block text-xl font-bold text-gray-800 mb-4">
                  Street Address
                </label>
                {isGoogleMapsLoaded ? (
                  <Autocomplete
                    onPlaceSelected={(place) => {
                      const address = place.formatted_address || '';
                      setContactData({ ...contactData, address });
                      
                      // Try to extract city, state, zip from place
                      const components = place.address_components || [];
                      components.forEach((component: any) => {
                        if (component.types.includes('locality')) {
                          setContactData(prev => ({ ...prev, city: component.long_name }));
                        }
                        if (component.types.includes('administrative_area_level_1')) {
                          setContactData(prev => ({ ...prev, state: component.short_name }));
                        }
                        if (component.types.includes('postal_code')) {
                          setContactData(prev => ({ ...prev, zipCode: component.long_name }));
                        }
                      });
                    }}
                    options={{
                      types: ['address'],
                      componentRestrictions: { country: 'us' },
                    }}
                    defaultValue={contactData.address}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#B43732] text-gray-800"
                    placeholder="Start typing your address..."
                  />
                ) : (
                  <input
                    type="text"
                    id="address"
                    value={contactData.address}
                    onChange={(e) => setContactData({ ...contactData, address: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#B43732] text-gray-800 bg-gray-50"
                    placeholder="Loading address autocomplete..."
                    disabled
                  />
                )}
              </div>

              {/* City, State, Zip Code Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* City */}
                <div className="md:col-span-1">
                  <label htmlFor="city" className="block text-xl font-bold text-gray-800 mb-4">
                    City
                  </label>
                  <input
                    type="text"
                    id="city"
                    value={contactData.city}
                    onChange={(e) => setContactData({ ...contactData, city: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#B43732] text-gray-800"
                    placeholder="City"
                  />
                </div>

                {/* State */}
                <div className="md:col-span-1">
                  <label htmlFor="state" className="block text-xl font-bold text-gray-800 mb-4">
                    State
                  </label>
                  <input
                    type="text"
                    id="state"
                    value={contactData.state}
                    onChange={(e) => setContactData({ ...contactData, state: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#B43732] text-gray-800"
                    placeholder="State"
                    maxLength={2}
                  />
                </div>

                {/* Zip Code */}
                <div className="md:col-span-1">
                  <label htmlFor="zipCode" className="block text-xl font-bold text-gray-800 mb-4">
                    Zip Code
                  </label>
                  <input
                    type="text"
                    id="zipCode"
                    value={contactData.zipCode}
                    onChange={(e) => setContactData({ ...contactData, zipCode: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#B43732] text-gray-800"
                    placeholder="Zip Code"
                    maxLength={5}
                  />
                </div>
              </div>

              <div className="flex justify-between pt-6 border-t border-gray-200">
                <button
                  onClick={handleBack}
                  className="px-8 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleNext}
                  className="px-8 py-3 bg-[#B43732] text-white font-semibold rounded-lg hover:bg-[#9A2F2B] transition-colors"
                >
                  Next: Review →
                </button>
              </div>
            </div>
          )}

          {/* Review Step */}
          {currentStep === 'review' && selectedRV && (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">
                  Review Your Purchase
                </h3>
                <p className="text-sm text-gray-600">
                  Please review all details before submitting your purchase request
                </p>
              </div>

              {/* Contact Information */}
              <div className="bg-white border border-gray-300 rounded-lg p-6">
                <h4 className="text-lg font-bold text-gray-800 mb-4">Contact Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Name:</span>
                    <span className="ml-2 text-gray-900 font-medium">{contactData.firstName} {contactData.lastName}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Email:</span>
                    <span className="ml-2 text-gray-900 font-medium">{contactData.email}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Phone:</span>
                    <span className="ml-2 text-gray-900 font-medium">{contactData.phone}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Address:</span>
                    <span className="ml-2 text-gray-900 font-medium">
                      {contactData.address}, {contactData.city}, {contactData.state} {contactData.zipCode}
                    </span>
                  </div>
                </div>
              </div>

              {/* Selected Unit & Delivery */}
              <div className="bg-white border border-gray-300 rounded-lg p-6">
                <h4 className="text-lg font-bold text-gray-800 mb-4">Unit Information</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Stock Number:</span>
                    <span className="text-gray-900 font-medium">#{configurationData.selectedStock}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Location:</span>
                    <span className="text-gray-900 font-medium">{getFullLocationName(selectedRV)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Delivery Method:</span>
                    <span className="text-gray-900 font-medium">{configurationData.deliveryMethod === 'pickup' ? 'Pick Up' : 'Ship To'}</span>
                  </div>
                  {configurationData.deliveryMethod === 'ship' && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="text-gray-600 mb-1">Shipping Address:</div>
                      <div className="text-gray-900 font-medium">
                        {configurationData.shippingAddress}<br />
                        {configurationData.shippingCity}, {configurationData.shippingState} {configurationData.shippingZipCode}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Ownership Protection Selected */}
              {Object.values(configurationData.ownershipProtection).some(selected => selected) && (
                <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-300">
                    <h4 className="text-lg font-bold text-gray-800">Ownership Protection</h4>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {configurationData.ownershipProtection.extendedServiceContract && (
                      <div className="flex justify-between px-6 py-3">
                        <div className="text-sm text-gray-700">Extended Service Contract</div>
                        <div className="text-sm font-semibold text-gray-800">{formatCurrency(OWNERSHIP_PROTECTION_PRICES.extendedServiceContract)}</div>
                      </div>
                    )}
                    {configurationData.ownershipProtection.paintAndFabric && (
                      <div className="flex justify-between px-6 py-3">
                        <div className="text-sm text-gray-700">Paint & Fabric Protection</div>
                        <div className="text-sm font-semibold text-gray-800">{formatCurrency(OWNERSHIP_PROTECTION_PRICES.paintAndFabric)}</div>
                      </div>
                    )}
                    {configurationData.ownershipProtection.tireAndWheel && (
                      <div className="flex justify-between px-6 py-3">
                        <div className="text-sm text-gray-700">Tire & Wheel Protection</div>
                        <div className="text-sm font-semibold text-gray-800">{formatCurrency(OWNERSHIP_PROTECTION_PRICES.tireAndWheel)}</div>
                      </div>
                    )}
                    {configurationData.ownershipProtection.monsterSeal && (
                      <div className="flex justify-between px-6 py-3">
                        <div className="text-sm text-gray-700">Monster Seal Protection</div>
                        <div className="text-sm font-semibold text-gray-800">{formatCurrency(OWNERSHIP_PROTECTION_PRICES.monsterSeal)}</div>
                      </div>
                    )}
                    {configurationData.ownershipProtection.gap && (
                      <div className="flex justify-between px-6 py-3">
                        <div className="text-sm text-gray-700">GAP Coverage</div>
                        <div className="text-sm font-semibold text-gray-800">{formatCurrency(OWNERSHIP_PROTECTION_PRICES.gap)}</div>
                      </div>
                    )}
                    {configurationData.ownershipProtection.fiveYearRoadside && (
                      <div className="flex justify-between px-6 py-3">
                        <div className="text-sm text-gray-700">5-Year Roadside Assistance</div>
                        <div className="text-sm font-semibold text-gray-800">{formatCurrency(OWNERSHIP_PROTECTION_PRICES.fiveYearRoadside)}</div>
                      </div>
                    )}
                    {configurationData.ownershipProtection.rvLife && (
                      <div className="flex justify-between px-6 py-3">
                        <div className="text-sm text-gray-700">RV Life Protection</div>
                        <div className="text-sm font-semibold text-gray-800">{formatCurrency(OWNERSHIP_PROTECTION_PRICES.rvLife)}</div>
                      </div>
                    )}
                    {configurationData.ownershipProtection.lifetimeBattery && (
                      <div className="flex justify-between px-6 py-3">
                        <div className="text-sm text-gray-700">Lifetime Battery Replacement</div>
                        <div className="text-sm font-semibold text-gray-800">{formatCurrency(OWNERSHIP_PROTECTION_PRICES.lifetimeBattery)}</div>
                      </div>
                    )}
                    {configurationData.ownershipProtection.roof && (
                      <div className="flex justify-between px-6 py-3">
                        <div className="text-sm text-gray-700">Roof Protection Plan</div>
                        <div className="text-sm font-semibold text-gray-800">{formatCurrency(OWNERSHIP_PROTECTION_PRICES.roof)}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pricing Breakdown */}
              <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
                <div className="divide-y divide-gray-300">
                  <div className="flex justify-between px-6 py-3">
                    <div className="font-semibold text-gray-800 uppercase text-sm">RV PRICE (15% KIEWIT DISCOUNT)</div>
                    <div className="font-semibold text-gray-800">
                      {formatCurrency(calculateDiscountedPrice(selectedRV.price))}
                    </div>
                  </div>

                  {configurationData.deliveryMethod === 'ship' && unitDistances.get(selectedRV.stock) && (
                    <div className="flex justify-between px-6 py-3">
                      <div className="text-gray-700 text-sm">SHIPPING ({unitDistances.get(selectedRV.stock)} mi × $2.50)</div>
                      <div className="text-gray-700">{formatCurrency(calculateShippingCost(unitDistances.get(selectedRV.stock)!))}</div>
                    </div>
                  )}

                  {/* Accessories */}
                  {(configurationData.powerPackage || configurationData.hitchPackage || configurationData.brakeControl) && (
                    <div className="flex justify-between px-6 py-3">
                      <div>
                        <div className="text-gray-700 text-sm">ACCESSORIES</div>
                        <div className="ml-4 mt-1 space-y-0.5 text-xs text-gray-600">
                          {configurationData.powerPackage === 'standard' && (
                            <div>• 2 Standard RV Batteries</div>
                          )}
                          {configurationData.powerPackage === '6volt' && (
                            <div>• 2 6 Volt RV Batteries</div>
                          )}
                          {configurationData.powerPackage === 'lithium' && (
                            <div>• 2 Upgraded Lithium RV Batteries</div>
                          )}
                          {configurationData.hitchPackage === 'anti-sway' && (
                            <div>• Anti-Sway Hitch</div>
                          )}
                          {configurationData.hitchPackage === 'fifth-wheel' && (
                            <div>• 5th Wheel Hitch Installation</div>
                          )}
                          {configurationData.brakeControl === 'wireless' && (
                            <div>• Wireless Brake Controller</div>
                          )}
                        </div>
                      </div>
                      <div className="text-gray-700">
                        {formatCurrency(
                          (configurationData.powerPackage === 'standard' ? 419 : 0) +
                          (configurationData.powerPackage === '6volt' ? 555 : 0) +
                          (configurationData.powerPackage === 'lithium' ? 1299 : 0) +
                          (configurationData.hitchPackage === 'anti-sway' ? 600 : 0) +
                          (configurationData.hitchPackage === 'fifth-wheel' ? 1200 : 0) +
                          (configurationData.brakeControl === 'wireless' ? 299 : 0)
                        )}
                      </div>
                    </div>
                  )}

                  {calculateOwnershipProtectionTotal() > 0 && (
                    <>
                      <div className="flex justify-between px-6 py-3">
                        <div>
                          <div className="text-gray-700 text-sm">OWNERSHIP PROTECTION</div>
                          <div className="ml-4 mt-1 space-y-0.5 text-xs text-gray-600">
                            {configurationData.ownershipProtection.extendedServiceContract && (
                              <div>• Extended Service Contract</div>
                            )}
                            {configurationData.ownershipProtection.paintAndFabric && (
                              <div>• Paint & Fabric Protection</div>
                            )}
                            {configurationData.ownershipProtection.tireAndWheel && (
                              <div>• Tire & Wheel Protection</div>
                            )}
                            {configurationData.ownershipProtection.monsterSeal && (
                              <div>• Monster Seal Protection</div>
                            )}
                            {configurationData.ownershipProtection.gap && (
                              <div>• GAP Coverage</div>
                            )}
                            {configurationData.ownershipProtection.fiveYearRoadside && (
                              <div>• 5-Year Roadside Assistance</div>
                            )}
                            {configurationData.ownershipProtection.rvLife && (
                              <div>• RV Life Protection</div>
                            )}
                            {configurationData.ownershipProtection.lifetimeBattery && (
                              <div>• Lifetime Battery Replacement</div>
                            )}
                            {configurationData.ownershipProtection.roof && (
                              <div>• Roof Protection Plan</div>
                            )}
                          </div>
                        </div>
                        <div className="text-gray-700">{formatCurrency(calculateOwnershipProtectionTotal())}</div>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between px-6 py-3">
                    <div className="text-gray-700 text-sm line-through">SALES PREP (Get Ready, Orientation, Detail, etc.)</div>
                    <div className="text-gray-700 font-semibold">Included</div>
                  </div>

                  <div className="flex justify-between px-6 py-3 bg-gray-50">
                    <div className="text-gray-700 text-sm">SUBTOTAL</div>
                    <div className="text-gray-700">{formatCurrency(calculateTotalPrice())}</div>
                  </div>

                  <div className="flex justify-between px-6 py-3">
                    <div className="text-gray-700 text-sm">ESTIMATED TAXES (6%)</div>
                    <div className="text-gray-700">{formatCurrency(calculateTotalPrice() * 0.06)}</div>
                  </div>

                  <div className="flex justify-between px-6 py-4 bg-gray-100">
                    <div className="font-bold text-lg text-gray-800">TOTAL PURCHASE PRICE</div>
                    <div className="font-bold text-lg text-gray-800">
                      {formatCurrency(calculateTotalPrice() * 1.06)}
                    </div>
                  </div>

                  {configurationData.paymentMethod === 'finance' && (
                    <>
                      <div className="flex justify-between px-6 py-3">
                        <div className="text-gray-700 text-sm">CASH DEPOSIT (20% Down)</div>
                        <div className="text-gray-700">{formatCurrency(calculateTotalPrice() * 1.06 * 0.20)}</div>
                      </div>

                      <div className="flex justify-between px-6 py-4 bg-[#B43732]">
                        <div className="font-bold text-lg text-white">BALANCE TO FINANCE</div>
                        <div className="font-bold text-lg text-white">
                          {formatCurrency(calculateTotalPrice() * 1.06 * 0.80)}
                        </div>
                      </div>
                      
                      <div className="flex justify-between px-6 py-3 bg-blue-50">
                        <div className="text-sm text-gray-700">
                          <div className="font-semibold">Est. Monthly Payment</div>
                          <div className="text-xs text-gray-600">0% APR for 120 months</div>
                        </div>
                        <div className="text-gray-900 font-bold">{formatCurrency((calculateTotalPrice() * 1.06 * 0.80) / 120)}/mo</div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Payment Method Note */}
              {configurationData.paymentMethod === 'cash' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h5 className="font-bold text-gray-800 mb-2 text-sm">Payment Method</h5>
                  <p className="text-sm text-gray-700">Cash Purchase - Full payment required before delivery</p>
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> This purchase request will be submitted to Bish's RV for processing. 
                  A sales representative will contact you shortly to complete the transaction.
                </p>
              </div>

              <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={handleBack}
                  className="px-8 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-6 py-3 bg-[#B43732] text-white text-xs font-bold uppercase tracking-wide rounded hover:bg-[#9A2F2B] transition-colors"
                >
                  Submit Purchase Order
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Signature Modal */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-8">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Sign to Confirm</h3>
            <p className="text-gray-600 mb-6">
              Please sign below to confirm your purchase request.
            </p>

            <div className="border-2 border-gray-300 rounded-lg mb-4">
              <canvas
                ref={canvasRef}
                width={600}
                height={200}
                className="w-full cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>

            <div className="flex justify-between items-center">
              <button
                onClick={clearSignature}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 underline"
              >
                Clear
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSignatureModal(false)}
                  className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSignatureSubmit}
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-[#B43732] text-white text-xs font-bold uppercase tracking-wide rounded hover:bg-[#9A2F2B] transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
