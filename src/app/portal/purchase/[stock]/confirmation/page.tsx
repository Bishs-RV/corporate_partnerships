'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

export default function PurchaseConfirmation() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userEmail, setUserEmail] = useState('');
  const [orderDetails, setOrderDetails] = useState<any>(null);

  useEffect(() => {
    // Check if user is verified
    const verified = localStorage.getItem('verified');
    const email = localStorage.getItem('userEmail');

    if (!verified || !email) {
      router.push('/');
      return;
    }

    setUserEmail(email);

    // Get order details from URL params
    const details = {
      rvName: searchParams.get('rvName'),
      stock: searchParams.get('stock'),
      totalPrice: searchParams.get('totalPrice'),
      paymentMethod: searchParams.get('paymentMethod'),
      deliveryMethod: searchParams.get('deliveryMethod'),
    };

    setOrderDetails(details);
  }, [router, searchParams]);

  const formatCurrency = (amount: string | null) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(Number(amount));
  };

  if (!orderDetails) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading confirmation...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Image
              src="/Kiewit-Logo.png"
              alt="Kiewit Logo"
              width={80}
              height={40}
              className="object-contain"
            />
            <div className="border-l border-gray-300 pl-4">
              <h1 className="text-2xl font-bold text-gray-900">Purchase Confirmation</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-md p-8 md:p-12">
          {/* Success Icon */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
              <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Thank You for Your Purchase!
            </h2>
            <p className="text-lg text-gray-600">
              Your purchase request has been successfully submitted.
            </p>
          </div>

          {/* Order Details */}
          <div className="border-t border-b border-gray-200 py-6 mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Order Summary</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">RV Model:</span>
                <span className="font-semibold text-gray-900">{orderDetails.rvName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Stock Number:</span>
                <span className="font-semibold text-gray-900">{orderDetails.stock}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Method:</span>
                <span className="font-semibold text-gray-900 capitalize">{orderDetails.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Delivery Method:</span>
                <span className="font-semibold text-gray-900">
                  {orderDetails.deliveryMethod === 'pickup' ? 'Pick Up' : 'Ship To'}
                </span>
              </div>
              <div className="flex justify-between pt-3 border-t border-gray-200">
                <span className="text-lg font-bold text-gray-900">Total Amount:</span>
                <span className="text-2xl font-bold text-blue-600">
                  {formatCurrency(orderDetails.totalPrice)}
                </span>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-4">What Happens Next?</h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center w-8 h-8 bg-slate-700 text-white rounded-full font-bold text-sm">
                    1
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Confirmation Email</h4>
                  <p className="text-sm text-gray-600">
                    You'll receive a confirmation email at <strong>{userEmail}</strong> with your order details within the next few minutes.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center w-8 h-8 bg-slate-700 text-white rounded-full font-bold text-sm">
                    2
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Bish's Representative Contact</h4>
                  <p className="text-sm text-gray-600">
                    A Bish's RV representative will contact you within 1-2 business days to finalize your purchase and discuss delivery details.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center w-8 h-8 bg-slate-700 text-white rounded-full font-bold text-sm">
                    3
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Final Documentation</h4>
                  <p className="text-sm text-gray-600">
                    Complete any remaining paperwork and payment processing with your Bish's representative to finalize your purchase.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center w-8 h-8 bg-slate-700 text-white rounded-full font-bold text-sm">
                    4
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">
                    {orderDetails.deliveryMethod === 'pickup' ? 'Pick Up Your RV' : 'Delivery'}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {orderDetails.deliveryMethod === 'pickup' 
                      ? 'Schedule a convenient time to pick up your new RV at the Bish\'s location.'
                      : 'Coordinate delivery of your new RV to your specified location.'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Need Help?</h3>
            <p className="text-sm text-gray-700 mb-3">
              If you have any questions about your purchase, feel free to contact Bish's RV:
            </p>
            <div className="space-y-1 text-sm text-gray-700">
              <p><strong>Phone:</strong> Contact your local Bish's RV location</p>
              <p><strong>Website:</strong> <a href="https://www.bishs.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">www.bishs.com</a></p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push('/portal')}
              className="px-8 py-3 bg-slate-700 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors"
            >
              Return to Portal
            </button>
            <button
              onClick={() => window.print()}
              className="px-8 py-3 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              Print Confirmation
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
