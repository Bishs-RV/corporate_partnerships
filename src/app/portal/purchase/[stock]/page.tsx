'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { RV } from '@/types/inventory';
import Image from 'next/image';
import { getPrimaryImage } from '@/lib/rvImages';

type Step = 'configuration' | 'contact' | 'review';

interface ConfigurationData {
  powerPackage?: string;
  hitchPackage?: string;
  brakeControl?: string;
  paymentMethod: 'cash' | 'finance';
  deliveryMethod: 'pickup' | 'ship';
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

export default function PurchaseWorkflow() {
  const router = useRouter();
  const params = useParams();
  const stock = params.stock as string;
  
  const [userEmail, setUserEmail] = useState('');
  const [rv, setRV] = useState<RV | null>(null);
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

    // Fetch the specific RV from the inventory
    async function fetchRV() {
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
        
        // Get all inventory from all locations to find the specific RV
        const response = await fetch(`/api/inventory?locationIds=${allLocationIds}`);
        const result = await response.json();
        
        if (result.success) {
          const foundRV = result.data.find((item: RV) => item.stock === stock);
          if (foundRV) {
            setRV(foundRV);
          } else {
            console.error('RV not found with stock:', stock);
            router.push('/portal');
          }
        } else {
          console.error('Failed to load inventory:', result.error);
          router.push('/portal');
        }
      } catch (err) {
        console.error('Error fetching RV:', err);
        router.push('/portal');
      }
    }

    fetchRV();
  }, [stock, router]);

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

  const calculateTotalPrice = () => {
    let total = calculateDiscountedPrice(rv?.price || 0);
    
    // Add option prices
    if (configurationData.powerPackage === 'standard') total += 419;
    if (configurationData.powerPackage === '6volt') total += 555;
    if (configurationData.powerPackage === 'lithium') total += 1299;
    if (configurationData.hitchPackage === 'anti-sway') total += 600;
    if (configurationData.brakeControl === 'wireless') total += 299;
    
    return total;
  };

  const handleNext = () => {
    if (currentStep === 'configuration') {
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
      if (!contactData.phone.trim() || contactData.phone.replace(/\D/g, '').length < 10) {
        alert('Please enter a valid phone number.');
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
      stock,
      rvId: rv?.id,
      configurationData,
      totalPrice: calculateTotalPrice(),
    });

    // Redirect to confirmation page with order details
    const params = new URLSearchParams({
      rvName: rv?.name || '',
      stock: stock,
      totalPrice: calculateTotalPrice().toString(),
      paymentMethod: configurationData.paymentMethod,
      deliveryMethod: configurationData.deliveryMethod,
      customerName: `${contactData.firstName} ${contactData.lastName}`,
      customerEmail: contactData.email,
      customerPhone: contactData.phone,
    });
    
    router.push(`/portal/purchase/${stock}/confirmation?${params.toString()}`);
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

  if (!rv) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading RV details...</div>
      </div>
    );
  }

  const discountedPrice = calculateDiscountedPrice(rv.price);

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
                <p className="text-sm text-gray-600 mt-0.5">{rv.name}</p>
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
                <h2 className="text-2xl font-bold text-gray-900">{rv.name}</h2>
                <p className="text-gray-600 mt-1">
                  {rv.year} {rv.make} • Stock #{rv.stock}
                </p>
                {/* RV Thumbnail */}
                {getPrimaryImage(rv.stock) && (
                  <div className="mt-3">
                    <img
                      src={getPrimaryImage(rv.stock)}
                      alt={rv.name}
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
                <p className="text-sm text-gray-500 line-through">
                  {formatCurrency(rv.price)}
                </p>
                <p className="text-xs text-green-600 font-semibold mt-1">
                  Save {formatCurrency(rv.price - discountedPrice)} (15% off MSRP)
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
                  Select optional upgrades and features for your RV
                </p>

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
                    <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <p className="text-sm text-slate-900">
                        <strong>Kiewit Employee Financing:</strong> 0% APR for 120 months
                      </p>
                      <p className="text-sm text-slate-800 mt-2">
                        <strong>Down Payment Required:</strong> 20% ({formatCurrency(calculateTotalPrice() * 0.20)})
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Power Package */}
              <div>
                <h4 className="text-xl font-bold text-gray-800 mb-4">Power Package</h4>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { id: 'standard', name: 'Two Standard RV Batteries', price: 419 },
                    { id: '6volt', name: 'Two 6-Volt RV Batteries', price: 555 },
                    { id: 'lithium', name: 'Two Upgraded Lithium RV Batteries', price: 1299 }
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setConfigurationData({ ...configurationData, powerPackage: option.id })}
                      className={`p-4 border-2 rounded-lg text-center transition-all ${
                        configurationData.powerPackage === option.id
                          ? 'border-slate-700 bg-slate-50 shadow-md'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex justify-center mb-3">
                        <svg className="w-12 h-12 text-slate-700" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4zM11 20v-5.5H9L13 7v5.5h2L11 20z"/>
                        </svg>
                      </div>
                      <div className="text-sm font-semibold text-gray-800 mb-2">{option.name}</div>
                      <div className="text-lg font-bold text-gray-900">+${option.price.toLocaleString()}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Hitch Package */}
              <div>
                <h4 className="text-xl font-bold text-gray-800 mb-4">Hitch Package</h4>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'have-hitch', name: 'I Already Have a Hitch', price: 0 },
                    { id: 'anti-sway', name: 'Integrated Anti Sway', price: 600 }
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setConfigurationData({ ...configurationData, hitchPackage: option.id })}
                      className={`p-4 border-2 rounded-lg text-center transition-all ${
                        configurationData.hitchPackage === option.id
                          ? 'border-slate-700 bg-slate-50 shadow-md'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex justify-center mb-3">
                        {option.id === 'have-hitch' ? (
                          <svg className="w-12 h-12 text-slate-700" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                          </svg>
                        ) : (
                          <svg className="w-12 h-12 text-slate-700" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                          </svg>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-gray-800 mb-2">{option.name}</div>
                      <div className="text-lg font-bold text-gray-900">
                        {option.price === 0 ? 'Included' : `+$${option.price.toLocaleString()}`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Brake Control */}
              <div>
                <h4 className="text-xl font-bold text-gray-800 mb-4">Brake Control</h4>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'installed', name: 'Already Installed', price: 0 },
                    { id: 'wireless', name: 'Wireless Brake Control', price: 299 }
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setConfigurationData({ ...configurationData, brakeControl: option.id })}
                      className={`p-4 border-2 rounded-lg text-center transition-all ${
                        configurationData.brakeControl === option.id
                          ? 'border-slate-700 bg-slate-50 shadow-md'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex justify-center mb-3">
                        {option.id === 'installed' ? (
                          <svg className="w-12 h-12 text-slate-700" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                          </svg>
                        ) : (
                          <svg className="w-12 h-12 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                          </svg>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-gray-800 mb-2">{option.name}</div>
                      <div className="text-lg font-bold text-gray-900">
                        {option.price === 0 ? 'Included' : `+$${option.price.toLocaleString()}`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={handleNext}
                  className="px-6 py-3 bg-[#B43732] text-white text-xs font-bold uppercase tracking-wide rounded hover:bg-[#9A2F2B] transition-colors"
                >
                  Next: Contact Information
                </button>
              </div>
            </div>
          )}

          {/* Contact Information Step */}
          {currentStep === 'contact' && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">
                Contact Information
              </h3>

              <div className="bg-white border-2 border-gray-300 rounded-lg p-6 space-y-6">
                {/* First and Last Name Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      placeholder="First name"
                    />
                  </div>

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
                      placeholder="Last name"
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
                    placeholder="Enter your email address"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label htmlFor="phone" className="block text-xl font-bold text-gray-800 mb-4">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={contactData.phone}
                    onChange={(e) => setContactData({ ...contactData, phone: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#B43732] text-gray-800"
                    placeholder="Enter your phone number"
                  />
                </div>

                {/* Address */}
                <div>
                  <label htmlFor="address" className="block text-xl font-bold text-gray-800 mb-4">
                    Street Address
                  </label>
                  <input
                    type="text"
                    id="address"
                    value={contactData.address}
                    onChange={(e) => setContactData({ ...contactData, address: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#B43732] text-gray-800"
                    placeholder="Enter your street address"
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
                      maxLength={10}
                    />
                  </div>
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={handleBack}
                  className="px-6 py-3 bg-gray-200 text-gray-700 text-xs font-bold uppercase tracking-wide rounded hover:bg-gray-300 transition-colors"
                >
                  Back to Configuration
                </button>
                <button
                  onClick={handleNext}
                  className="px-6 py-3 bg-[#B43732] text-white text-xs font-bold uppercase tracking-wide rounded hover:bg-[#9A2F2B] transition-colors"
                >
                  Next: Review Purchase
                </button>
              </div>
            </div>
          )}

          {/* Review Step */}
          {currentStep === 'review' && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">
                Review Your Purchase
              </h3>

              {/* Purchase Summary */}
              <div className="bg-white border-2 border-gray-300 rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-6 py-3 border-b-2 border-gray-300">
                  <h4 className="font-bold text-gray-800">DESCRIPTION</h4>
                </div>
                
                <div className="divide-y divide-gray-300">
                  {/* Main Unit */}
                  <div className="flex justify-between px-6 py-4">
                    <div>
                      <div className="font-semibold text-gray-800">
                        {rv.year} {rv.make}
                      </div>
                      <div className="text-sm text-gray-600">{rv.name}</div>
                      <div className="text-xs text-gray-500 mt-1">Stock #{rv.stock}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500 line-through">{formatCurrency(rv.price)}</div>
                      <div className="font-semibold text-gray-800">
                        {formatCurrency(discountedPrice)}
                      </div>
                      <div className="text-xs text-green-600">Kiewit Discount</div>
                    </div>
                  </div>

                  {/* Configuration Items */}
                  {configurationData.powerPackage && (
                    <div className="flex justify-between px-6 py-3 bg-gray-50">
                      <div className="text-sm text-gray-700">
                        {configurationData.powerPackage === 'standard' && 'Two Standard RV Batteries'}
                        {configurationData.powerPackage === '6volt' && 'Two 6-Volt RV Batteries'}
                        {configurationData.powerPackage === 'lithium' && 'Two Upgraded Lithium RV Batteries'}
                      </div>
                      <div className="text-sm font-semibold text-gray-800">
                        {configurationData.powerPackage === 'standard' && formatCurrency(419)}
                        {configurationData.powerPackage === '6volt' && formatCurrency(555)}
                        {configurationData.powerPackage === 'lithium' && formatCurrency(1299)}
                      </div>
                    </div>
                  )}

                  {configurationData.hitchPackage === 'anti-sway' && (
                    <div className="flex justify-between px-6 py-3 bg-gray-50">
                      <div className="text-sm text-gray-700">Integrated Anti Sway Hitch</div>
                      <div className="text-sm font-semibold text-gray-800">{formatCurrency(600)}</div>
                    </div>
                  )}

                  {configurationData.brakeControl === 'wireless' && (
                    <div className="flex justify-between px-6 py-3 bg-gray-50">
                      <div className="text-sm text-gray-700">Wireless Brake Control</div>
                      <div className="text-sm font-semibold text-gray-800">{formatCurrency(299)}</div>
                    </div>
                  )}

                  {/* Total */}
                  <div className="flex justify-between px-6 py-4 bg-blue-50">
                    <div className="font-bold text-gray-800 text-lg">TOTAL</div>
                    <div className="font-bold text-blue-600 text-xl">{formatCurrency(calculateTotalPrice())}</div>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-4">Contact Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  Submit Purchase Request
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
