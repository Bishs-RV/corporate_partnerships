'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { RV } from '@/types/inventory';
import Image from 'next/image';
import { getPrimaryImage } from '@/lib/rvImages';
import Autocomplete from 'react-google-autocomplete';
import { PatternFormat } from 'react-number-format';

type Step = 'configuration' | 'contact' | 'review';

interface ConfigurationData {
  powerPackage?: string;
  hitchPackage?: string;
  brakeControl?: string;
  paymentMethod: 'cash' | 'finance';
  deliveryMethod: 'pickup' | 'ship';
  selectedStock?: string; // Which specific unit the user selects
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
  const [currentStep, setCurrentStep] = useState<Step>('configuration');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [userZip, setUserZip] = useState<string>('');

  const [configurationData, setConfigurationData] = useState<ConfigurationData>({
    paymentMethod: 'cash',
    deliveryMethod: 'ship',
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

  const calculateTotalPrice = () => {
    let total = calculateDiscountedPrice(selectedRV?.price || 0);
    
    // Add option prices
    if (configurationData.powerPackage === 'standard') total += 419;
    if (configurationData.powerPackage === '6volt') total += 555;
    if (configurationData.powerPackage === 'lithium') total += 1299;
    if (configurationData.hitchPackage === 'anti-sway') total += 600;
    if (configurationData.brakeControl === 'wireless') total += 299;
    
    return total;
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

  const handleNext = () => {
    if (currentStep === 'configuration') {
      // Validate stock selection
      if (!configurationData.selectedStock) {
        alert('Please select a specific unit.');
        return;
      }
      // Validate ZIP code if Ship To is selected
      if (configurationData.deliveryMethod === 'ship' && userZip.length !== 5) {
        alert('Please enter a valid 5-digit ZIP code for shipping.');
        return;
      }
      setCurrentStep('contact');
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
    }
  };

  const handleBack = () => {
    if (currentStep === 'review') {
      setCurrentStep('contact');
    } else if (currentStep === 'contact') {
      setCurrentStep('configuration');
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
    const steps: Step[] = ['configuration', 'contact', 'review'];
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
              <span className={currentStep === 'contact' ? 'text-blue-600' : 'text-gray-500'}>
                Contact Info
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
                  Select your specific unit and optional upgrades
                </p>

                {/* Unit Selection - Only show if multiple units available */}
                {availableUnits.length > 1 && (
                  <div className="mb-8">
                    <label className="block text-xl font-bold text-gray-800 mb-4">
                      Select Specific Unit <span className="text-red-600">*</span>
                    </label>
                    <p className="text-sm text-gray-600 mb-4">
                      We have {availableUnits.length} units of this model available. Please select your preferred unit:
                    </p>
                    <div className="space-y-3">
                      {availableUnits.map((unit) => (
                        <button
                          key={unit.stock}
                          onClick={() => handleStockSelection(unit.stock)}
                          className={`w-full text-left p-4 border-2 rounded-lg transition-all ${
                            configurationData.selectedStock === unit.stock
                              ? 'border-blue-600 bg-blue-50'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-semibold text-gray-900">Stock #{unit.stock}</p>
                              <p className="text-sm text-gray-600">{unit.location || 'Location TBD'}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-blue-600">{formatCurrency(calculateDiscountedPrice(unit.price))}</p>
                              <p className="text-xs text-gray-500">MSRP: {formatCurrency(unit.price)}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

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
                      onClick={() => setConfigurationData({ ...configurationData, deliveryMethod: 'ship' })}
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

                {/* Zip Code Input - Only show if Ship To is selected */}
                {configurationData.deliveryMethod === 'ship' && (
                  <div className="mb-8">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Shipping ZIP Code <span className="text-red-600">*</span>
                    </label>
                    <p className="text-xs text-gray-600 mb-3">
                      Enter your ZIP code so we can properly calculate shipping costs
                    </p>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        placeholder="Enter ZIP Code"
                        value={userZip}
                        onChange={(e) => {
                          const zip = e.target.value.replace(/\D/g, '').slice(0, 5);
                          setUserZip(zip);
                          // Save to localStorage when changed
                          if (zip.length === 5) {
                            localStorage.setItem('userZip', zip);
                          }
                        }}
                        className="w-40 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-blue-600 focus:ring-1 focus:ring-blue-200 focus:outline-none"
                        maxLength={5}
                        required
                      />
                      {userZip.length === 5 && (
                        <span className="text-sm text-green-600 flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Valid
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Cash vs Finance Toggle */}
                <div className="mb-8">
                  <label className="block text-xl font-bold text-gray-800 mb-4">Payment Method</label>
                  <div className="inline-flex rounded-lg border-2 border-gray-300 overflow-hidden">
                    <button
                      onClick={() => setConfigurationData({ ...configurationData, paymentMethod: 'cash' })}
                      className={`px-8 py-3 font-semibold transition-colors ${
                        configurationData.paymentMethod === 'cash'
                          ? 'bg-slate-700 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Cash
                    </button>
                    <button
                      onClick={() => setConfigurationData({ ...configurationData, paymentMethod: 'finance' })}
                      className={`px-8 py-3 font-semibold transition-colors ${
                        configurationData.paymentMethod === 'finance'
                          ? 'bg-slate-700 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Finance
                    </button>
                  </div>
                  {configurationData.paymentMethod === 'finance' && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-900 mb-2">
                        <strong>Kiewit Financing Benefits:</strong>
                      </p>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• 0% APR for 120 months (10 years)</li>
                        <li>• 20% down payment required</li>
                        <li>• Estimated monthly payment: <strong>{formatCurrency((calculateTotalPrice() * 0.80) / 120)}/mo</strong></li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-gray-200">
                <button
                  onClick={handleNext}
                  className="px-8 py-3 bg-[#B43732] text-white font-semibold rounded-lg hover:bg-[#9A2F2B] transition-colors"
                >
                  Next: Contact Info →
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
                <Autocomplete
                  apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
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
          {currentStep === 'review' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-6">
                  Review Your Purchase
                </h3>
                <p className="text-gray-600 mb-6">
                  Please review all details before submitting your purchase request
                </p>
              </div>

              {/* Selected Unit */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-3">Selected Unit</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Stock Number</p>
                    <p className="text-gray-800 font-medium">#{configurationData.selectedStock}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Location</p>
                    <p className="text-gray-800 font-medium">{selectedRV.location || 'TBD'}</p>
                  </div>
                </div>
              </div>

              {/* Configuration Summary */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-3">Configuration</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Delivery Method:</span>
                    <span className="font-medium text-gray-900 capitalize">{configurationData.deliveryMethod === 'pickup' ? 'Pick Up' : 'Ship To'}</span>
                  </div>
                  {configurationData.deliveryMethod === 'ship' && (
                    <div className="flex justify-between">
                      <span className="text-gray-700">Shipping ZIP:</span>
                      <span className="font-medium text-gray-900">{userZip}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-3">Contact Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="text-gray-800 font-medium">{contactData.firstName} {contactData.lastName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="text-gray-800 font-medium">{contactData.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="text-gray-800 font-medium">{contactData.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Address</p>
                    <p className="text-gray-800 font-medium">
                      {contactData.address}<br />
                      {contactData.city}, {contactData.state} {contactData.zipCode}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-3">Payment Method</h4>
                {configurationData.paymentMethod === 'cash' ? (
                  <p className="text-gray-700">Cash Purchase</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-gray-700 font-semibold">Financing - 0% APR for 120 months</p>
                    <p className="text-sm text-gray-600">Down Payment (20%): {formatCurrency(calculateTotalPrice() * 0.20)}</p>
                    <p className="text-sm text-gray-600">Loan Amount: {formatCurrency(calculateTotalPrice() * 0.80)}</p>
                    <p className="text-sm text-gray-600">Est. Monthly Payment: {formatCurrency((calculateTotalPrice() * 0.80) / 120)}/mo</p>
                  </div>
                )}
              </div>

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
  );
}
