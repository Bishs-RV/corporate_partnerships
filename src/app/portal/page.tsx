'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface RV {
  id: string;
  stock: string;
  name: string;
  year: number;
  type: string;
  price: number;
  description: string;
  length: number;
  weight: number;
  sleeps: number;
}

// Real Bishs RV inventory data with Kiewit employee discounts
const mockInventory: RV[] = [
  {
    id: '1',
    stock: '96530',
    name: 'Alliance RV Delta Ultra Lite RK234',
    year: 2026,
    type: 'Travel Trailer',
    price: 47995,
    description: 'Features a walk-through bath and two entry/exit doors. Sleeps 4, is 28ft long, and weighs approximately 5,600 lbs.',
    length: 28,
    weight: 5600,
    sleeps: 4,
  },
  {
    id: '2',
    stock: 'L03925',
    name: 'Alliance RV Delta Ultra Lite BH241',
    year: 2026,
    type: 'Travel Trailer',
    price: 54995,
    description: 'Bunkhouse model with a front bedroom. Sleeps 7, is 30ft long, and weighs approximately 5,893 lbs.',
    length: 30,
    weight: 5893,
    sleeps: 7,
  },
  {
    id: '3',
    stock: '95026',
    name: 'Alliance RV Delta Ultra Lite RL252',
    year: 2025,
    type: 'Travel Trailer',
    price: 48995,
    description: 'Rear living area floorplan with a kitchen island. Sleeps 4, is 30ft long, and weighs approximately 6,100 lbs.',
    length: 30,
    weight: 6100,
    sleeps: 4,
  },
  {
    id: '4',
    stock: '94065',
    name: 'Alliance RV Delta Ultra Lite RB262',
    year: 2025,
    type: 'Travel Trailer',
    price: 49995,
    description: 'Features a rear bath and outdoor kitchen. Sleeps 4, is 30ft long, and weighs approximately 6,400 lbs.',
    length: 30,
    weight: 6400,
    sleeps: 4,
  },
  {
    id: '5',
    stock: '95048',
    name: 'Alliance RV Delta Ultra Lite RK292',
    year: 2025,
    type: 'Travel Trailer',
    price: 52995,
    description: 'Rear kitchen layout with a front bedroom. Sleeps 4, is 34ft long, and weighs approximately 6,900 lbs.',
    length: 34,
    weight: 6900,
    sleeps: 4,
  },
  {
    id: '6',
    stock: '94057',
    name: 'Alliance RV Delta Ultra Lite BH294',
    year: 2025,
    type: 'Travel Trailer',
    price: 53995,
    description: 'Large bunkhouse model with an outside kitchen. Sleeps 8, is 34ft long, and weighs approximately 7,100 lbs.',
    length: 34,
    weight: 7100,
    sleeps: 8,
  },
];

export default function PortalPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [filteredInventory, setFilteredInventory] = useState<RV[]>(mockInventory);
  const [selectedType, setSelectedType] = useState<string>('all');

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

  useEffect(() => {
    if (selectedType === 'all') {
      setFilteredInventory(mockInventory);
    } else {
      setFilteredInventory(mockInventory.filter(rv => rv.type === selectedType));
    }
  }, [selectedType]);

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

  // Calculate Kiewit employee discount (15% off)
  const KIEWIT_DISCOUNT_PERCENT = 0.15;
  const calculateDiscountedPrice = (price: number) => Math.round(price * (1 - KIEWIT_DISCOUNT_PERCENT));
  const totalRegularPrice = mockInventory.reduce((sum, rv) => sum + rv.price, 0);
  const totalDiscountedPrice = mockInventory.reduce((sum, rv) => sum + calculateDiscountedPrice(rv.price), 0);
  const totalSavings = totalRegularPrice - totalDiscountedPrice;

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
              src="/Kiewit-logo.png"
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
            Enjoy <strong>15% off</strong> all RVs with your Kiewit employee discount. Save up to <strong>${(Math.max(...mockInventory.map(rv => rv.price * KIEWIT_DISCOUNT_PERCENT))).toLocaleString()}</strong> per vehicle.
          </p>
        </div>

        {/* Filter Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Filter by Type</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedType === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:border-blue-600'
              }`}
            >
              All ({mockInventory.length})
            </button>
            {['Class A', 'Class C', 'Travel Trailer', 'Diesel Pusher'].map(type => {
              const count = mockInventory.filter(rv => rv.type === type).length;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedType === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:border-blue-600'
                  }`}
                >
                  {type} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Inventory Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredInventory.map(rv => {
            const discountedPrice = calculateDiscountedPrice(rv.price);
            const savings = rv.price - discountedPrice;

            return (
              <div key={rv.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden">
                <div className="bg-gray-200 h-48 flex items-center justify-center relative">
                  <Image
                    src={`/${rv.id}.jpg`}
                    alt={rv.name}
                    fill
                    className="object-cover"
                  />
                </div>

                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{rv.name}</h3>
                      <p className="text-sm text-gray-600">{rv.year} • {rv.length}ft • {rv.type}</p>
                    </div>
                    <div className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-sm font-semibold">
                      -15%
                    </div>
                  </div>

                  <p className="text-gray-600 text-sm mb-3">{rv.description}</p>

                  <div className="grid grid-cols-2 gap-2 mb-4 text-xs text-gray-600 border-t pt-3">
                    <div>
                      <p className="font-semibold">Length</p>
                      <p>{rv.length}ft</p>
                    </div>
                    <div>
                      <p className="font-semibold">Weight</p>
                      <p>{rv.weight.toLocaleString()} lbs</p>
                    </div>
                    <div>
                      <p className="font-semibold">Sleeps</p>
                      <p>{rv.sleeps}</p>
                    </div>
                    <div>
                      <p className="font-semibold">Year</p>
                      <p>{rv.year}</p>
                    </div>
                  </div>

                  <div className="border-t pt-4 mb-4">
                    <p className="text-sm text-gray-600 line-through">
                      ${rv.price.toLocaleString()}
                    </p>
                    <p className="text-2xl font-bold text-blue-600">
                      ${discountedPrice.toLocaleString()}
                    </p>
                    <p className="text-sm text-green-600 font-semibold">
                      Save ${savings.toLocaleString()}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button className="flex-1 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors">
                      Buy Now
                    </button>
                    <a
                      href={`https://www.bishs.com/new-rvs-for-sale?stock=${rv.stock}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-center"
                    >
                      More Details
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredInventory.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">No RVs found in this category.</p>
          </div>
        )}
      </main>
    </div>
  );
}
