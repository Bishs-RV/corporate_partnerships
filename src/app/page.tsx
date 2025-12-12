import Image from "next/image";
import EmailSignupForm from '@/components/EmailSignupForm';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation/Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/bishs_logo.jpg"
              alt="Bishs Logo"
              width={80}
              height={80}
            />
          </div>
          <div className="text-sm text-gray-600">
            Employee Purchase Program
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
                    Seamless Process
                  </h3>
                  <p className="text-gray-600 mt-1">
                    From browsing to delivery, enjoy a streamlined purchasing experience designed for you.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA Section */}
            <div className="border-t pt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Get Started Today
              </h2>
              <p className="text-gray-600 mb-6">
                Enter your email address to gain access to our exclusive RV inventory and special employee pricing.
              </p>
              <EmailSignupForm />
            </div>
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
