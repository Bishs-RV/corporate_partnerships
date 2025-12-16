'use client';

import Image from "next/image";
import EmailSignupForm from '@/components/EmailSignupForm';
import LocationsMap from '@/components/LocationsMap';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation/Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Image
              src="/bishs_logo.jpg"
              alt="Bishs Logo"
              width={80}
              height={80}
            />
            <div className="border-l border-gray-300 pl-6 flex items-center gap-3">
              <Image
                src="/Kiewit-Logo.png"
                alt="Kiewit Logo"
                width={100}
                height={50}
                className="object-contain"
              />
              <span className="text-sm font-semibold text-gray-700">Employee Program</span>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            Exclusive Partnership
          </div>
        </nav>
      </header>

      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl">
          {/* Header */}
          <div className="mb-12 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Exclusive RV Purchase Program
            </h1>
            <p className="text-xl text-gray-600">
              Partner with Bishs for Premium RV Deals
            </p>
            <p className="text-md text-gray-500 mt-2">
              For Employees of Participating Companies
            </p>
          </div>

          {/* CTA Button */}
          <div className="text-center mb-8">
            <button
              onClick={() => {
                document.getElementById('signup-section')?.scrollIntoView({ 
                  behavior: 'smooth',
                  block: 'center'
                });
              }}
              className="px-10 py-3.5 bg-[#B43732] hover:bg-[#9A2F2B] text-white font-bold text-base uppercase tracking-wide rounded transition-colors"
            >
              Get Started
            </button>
          </div>

          {/* Program Benefits */}
          <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-10 w-10 rounded-md bg-blue-600 text-white font-bold">
                    ✓
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Pre-Negotiated Pricing
                  </h3>
                  <p className="text-gray-600 mt-1">
                    Get exclusive discounts on RVs available only to company employees through Bishs dealer network.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-10 w-10 rounded-md bg-blue-600 text-white font-bold">
                    ✓
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Curated Selection
                  </h3>
                  <p className="text-gray-600 mt-1">
                    Browse a handpicked collection of quality RVs selected specifically for you by Bishs experts.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-10 w-10 rounded-md bg-blue-600 text-white font-bold">
                    ✓
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Expert Support
                  </h3>
                  <p className="text-gray-600 mt-1">
                    Get dedicated support from Bishs specialists throughout your purchase journey.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-10 w-10 rounded-md bg-blue-600 text-white font-bold">
                    ✓
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Multi-Layered Support
                  </h3>
                  <p className="text-gray-600 mt-1">
                    Access comprehensive support through one-call concierge service, our RVFix program, nationwide service locations, and deployed out-of-network technicians when needed.
                  </p>
                </div>
              </div>
            </div>

            {/* Seamless Process - Process Overview */}
            <div className="border-t pt-10 pb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 text-center">
                Seamless Process
              </h2>
              <p className="text-gray-600 mb-10 text-center">
                Your journey to RV ownership. Simplified in these easy steps.
              </p>

              <div className="flex flex-col md:flex-row items-start justify-between gap-6 md:gap-2">
                {/* Step 1 - Sign In */}
                <div className="relative text-center flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1 text-sm">Sign In</h3>
                  <p className="text-xs text-gray-600">
                    Access with your Kiewit email
                  </p>
                </div>

                {/* Connector */}
                <div className="hidden md:block text-gray-300">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>

                {/* Step 2 - Browse */}
                <div className="relative text-center flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1 text-sm">Browse</h3>
                  <p className="text-xs text-gray-600">
                    Find your perfect RV
                  </p>
                </div>

                {/* Connector */}
                <div className="hidden md:block text-gray-300">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>

                {/* Step 3 - Customize */}
                <div className="relative text-center flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1 text-sm">Customize</h3>
                  <p className="text-xs text-gray-600">
                    Choose accessories & location
                  </p>
                </div>

                {/* Connector */}
                <div className="hidden md:block text-gray-300">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>

                {/* Step 4 - Finance */}
                <div className="relative text-center flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1 text-sm">Finance</h3>
                  <p className="text-xs text-gray-600">
                    Complete with preferred lender
                  </p>
                </div>

                {/* Connector */}
                <div className="hidden md:block text-gray-300">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>

                {/* Step 5 - Delivery */}
                <div className="relative text-center flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1 text-sm">Delivery</h3>
                  <p className="text-xs text-gray-600">
                    Get delivery & orientation
                  </p>
                </div>
              </div>
            </div>

            {/* CTA Section */}
            <div id="signup-section" className="border-t pt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
                Get Started Today
              </h2>
              <p className="text-gray-600 mb-6 text-center">
                Enter your email address to gain access to our exclusive RV inventory and special employee pricing.
              </p>
              <EmailSignupForm />
            </div>
          </div>

          {/* Locations Map Section */}
          <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 mb-8">
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 tracking-tight">
                Coast-to-Coast Inventory & Service
              </h2>
              <p className="text-base text-gray-700 leading-relaxed max-w-3xl">
                Browse from our nationwide inventory across multiple dealership locations from coast to coast. 
                Choose to <span className="font-semibold text-gray-900">pick up your RV</span> at any of our locations or 
                have it <span className="font-semibold text-gray-900">shipped directly to you</span>.
              </p>
              <p className="text-base text-gray-700 leading-relaxed max-w-3xl mt-3">
                Each location offers full onsite service capabilities, and through our 
                <span className="font-semibold text-blue-600"> RVFix program</span>, 
                you'll have access to nationwide service support wherever your adventures take you.
              </p>
            </div>
            <LocationsMap apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''} />
          </div>

          {/* Footer Note */}
          <div className="text-center text-sm text-gray-600">
            <p className="mb-2">
              Your email will only be used to provide you access to the Bishs employee purchase program.
            </p>
            <p className="text-xs text-gray-500">
              © 2024 Bishs. All rights reserved.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
