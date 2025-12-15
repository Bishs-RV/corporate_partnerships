import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { RV } from '@/types/inventory';
import { getPrimaryImage, getAllImages, getDetailUrl } from '@/lib/rvImages';

interface RVCardProps {
  rv: RV;
  discountPercent?: number;
  typeDescription?: string; // Full RV type name
  locations?: Array<{ cmf: number; location: string; storename: string }>;
  distanceInMiles?: number | null; // Distance from user's location
  onBuyNow?: (rv: RV) => void;
  onViewDetails?: (rv: RV) => void;
}

export default function RVCard({ 
  rv, 
  discountPercent = 0.15, // 15% default discount
  typeDescription,
  locations = [],
  distanceInMiles = null,
  onBuyNow,
  onViewDetails 
}: RVCardProps) {
  const calculateDiscountedPrice = (price: number) => Math.round(price * (1 - discountPercent));
  const discountedPrice = calculateDiscountedPrice(rv.price);
  const priceSavings = rv.price - discountedPrice;
  const discountLabel = `${Math.round(discountPercent * 100)}%`;
  
  // Financing calculations
  const financingMonths = 120; // 10 years
  const typicalAPR = 0.0899; // 8.99%
  const kiewitAPR = 0.0; // 0% for Kiewit employees
  
  // Calculate monthly payment with interest: P * [r(1+r)^n] / [(1+r)^n - 1]
  const calculateMonthlyPayment = (principal: number, annualRate: number, months: number) => {
    if (annualRate === 0) return principal / months;
    const monthlyRate = annualRate / 12;
    const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
    return payment;
  };
  
  // Calculate total interest paid
  const typicalMonthlyPayment = calculateMonthlyPayment(discountedPrice, typicalAPR, financingMonths);
  const kiewitMonthlyPayment = calculateMonthlyPayment(discountedPrice, kiewitAPR, financingMonths);
  const typicalTotalPaid = typicalMonthlyPayment * financingMonths;
  const kiewitTotalPaid = kiewitMonthlyPayment * financingMonths;
  const interestSavings = Math.round(typicalTotalPaid - kiewitTotalPaid);
  
  // Total savings (price discount + interest savings)
  const totalSavings = priceSavings + interestSavings;
  
  // Location display - lookup full location name from locations array using cmfId
  // Show only the full store name (not the three-letter code)
  const foundLocation = rv.cmfId ? locations.find(loc => loc.cmf === rv.cmfId) : null;
  const locationDisplay = foundLocation
    ? foundLocation.storename
    : rv.location || '';
  
  // Get images for this RV by stock number
  const rvImage = getPrimaryImage(rv.stock);
  const allImages = getAllImages(rv.stock);
  const detailUrl = getDetailUrl(rv.stock);
  const [showImageModal, setShowImageModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [thumbnailIndex, setThumbnailIndex] = useState(0);

  const hasImages = allImages.length > 0;
  const hasMultipleImages = allImages.length > 1;

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  const nextThumbnail = (e: React.MouseEvent) => {
    e.stopPropagation();
    setThumbnailIndex((prev) => (prev + 1) % allImages.length);
  };

  const prevThumbnail = (e: React.MouseEvent) => {
    e.stopPropagation();
    setThumbnailIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden flex flex-col h-full">
        {/* Image Section with Mini Gallery */}
        <div 
          className={`bg-gray-200 h-48 flex items-center justify-center relative group ${hasImages ? 'cursor-pointer' : ''}`}
          onClick={() => hasImages && setShowImageModal(true)}
        >
          <Image
            src={hasImages ? allImages[thumbnailIndex] : "/no-image-placeholder.svg"}
            alt={rv.name}
            fill
            className="object-cover"
            unoptimized={hasImages}
            loading="lazy"
          />
          
          {/* Thumbnail Navigation Arrows */}
          {hasMultipleImages && (
            <>
              <button
                onClick={prevThumbnail}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={nextThumbnail}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
          
          {/* Image Counter and Expand Icon */}
          {hasImages && (
            <div className="absolute bottom-2 right-2 flex items-center gap-2">
              {hasMultipleImages && (
                <div className="bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                  {thumbnailIndex + 1}/{allImages.length}
                </div>
              )}
              <div className="bg-black bg-opacity-60 text-white p-1.5 rounded group-hover:bg-opacity-80 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </div>
            </div>
          )}
        </div>

      {/* Content Section */}
      <div className="p-6 flex flex-col flex-1">
        {/* Header with Discount Badge */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            {detailUrl ? (
              <a 
                href={detailUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-base font-bold text-gray-900 hover:text-blue-600 mb-1 uppercase transition-colors inline-block"
              >
                {rv.name}
              </a>
            ) : (
              <h3 className="text-base font-bold text-gray-900 mb-1 uppercase">{rv.name}</h3>
            )}
            {/* Stock Number, Location, and Distance on same line */}
            {rv.stock && rv.stock !== 'N/A' && (
              <p className="text-xs text-gray-500 mb-1">
                Stock #{rv.stock}
                {locationDisplay && ` • ${locationDisplay}`}
                {distanceInMiles !== null && distanceInMiles !== undefined && (
                  <span className="text-blue-600 font-semibold"> ({distanceInMiles} mi)</span>
                )}
              </p>
            )}
            <p className="text-sm text-gray-600">
              {rv.year} • {typeDescription || rv.type}
            </p>
          </div>
          <div className="bg-red-100 text-red-700 px-3 py-1 rounded text-xs font-bold">
            -{discountLabel}
          </div>
        </div>

        {/* Specs Section */}
        <div className="grid grid-cols-3 gap-2 mb-4 text-xs text-gray-600 border-t border-b py-3">
          <div>
            <p className="font-semibold text-gray-700">Length</p>
            <p>{rv.length > 0 ? `${rv.length.toFixed(1)}ft` : 'N/A'}</p>
          </div>
          <div>
            <p className="font-semibold text-gray-700">Sleeps</p>
            <p>{rv.sleeps > 0 ? rv.sleeps : 'N/A'}</p>
          </div>
          <div>
            <p className="font-semibold text-gray-700">Weight</p>
            <p>{rv.weight > 0 ? `${rv.weight.toLocaleString()} lbs` : 'N/A'}</p>
          </div>
        </div>

        {/* Pricing Section */}
        <div className="border-t pt-4 mb-4">
          <p className="text-sm text-gray-600 line-through">
            MSRP: ${rv.price.toLocaleString()}
          </p>
          <p className="text-2xl font-bold text-blue-600">
            ${discountedPrice.toLocaleString()}
          </p>
          
          {/* Savings Breakdown */}
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between text-green-600">
              <span>Price Discount ({discountLabel}):</span>
              <span className="font-semibold">${priceSavings.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-green-600">
              <span>0% Financing Savings:</span>
              <span className="font-semibold">${interestSavings.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-green-700 font-bold text-base pt-2 border-t border-green-200">
              <span>Total Savings:</span>
              <span>${totalSavings.toLocaleString()}</span>
            </div>
          </div>
          
          {/* Financing Details */}
          <div className="mt-3 pt-3 border-t text-xs text-gray-600">
            <p className="font-semibold text-gray-700 mb-1">Kiewit Employee Financing:</p>
            <p>${Math.round(kiewitMonthlyPayment).toLocaleString()}/mo • 0% APR • 120 months</p>
            <p className="text-gray-500 mt-1">vs ${Math.round(typicalMonthlyPayment).toLocaleString()}/mo typical @ 8.99% APR</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mt-auto">
          <Link
            href={`/portal/purchase/${rv.stock}`}
            className="flex items-center justify-center text-center px-6 py-3 bg-[#B43732] text-white text-xs font-bold uppercase tracking-wide rounded hover:bg-[#9A2F2B] transition-colors"
          >
            Buy Now
          </Link>
          {detailUrl ? (
            <a 
              href={detailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center text-center px-6 py-3 bg-[#1A1A1A] text-white text-xs font-bold uppercase tracking-wide rounded hover:bg-black transition-colors relative"
            >
              Learn More
              <svg 
                className="w-3 h-3 inline-block ml-1 absolute top-1 right-1" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ) : (
            <button 
              onClick={() => onViewDetails?.(rv)}
              className="flex items-center justify-center text-center px-6 py-3 bg-[#1A1A1A] text-white text-xs font-bold uppercase tracking-wide rounded hover:bg-black transition-colors"
            >
              Learn More
            </button>
          )}
        </div>
      </div>
    </div>

    {/* Image Modal with Full Carousel */}
    {showImageModal && hasImages && (
      <div 
        className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center"
        onClick={() => setShowImageModal(false)}
      >
        <div className="relative w-full h-full flex items-center justify-center p-4">
          {/* Close Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowImageModal(false);
            }}
            className="absolute top-4 right-4 text-white bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full p-3 z-10 transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* Previous Image Button */}
          {hasMultipleImages && (
            <button
              onClick={prevImage}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full p-4 z-10 transition-all"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          
          {/* Large Image */}
          <div 
            className="relative max-w-6xl max-h-[85vh] w-full h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={allImages[currentImageIndex]}
              alt={`${rv.name} - Image ${currentImageIndex + 1}`}
              width={1600}
              height={1200}
              className="object-contain max-w-full max-h-full"
              unoptimized
              loading="lazy"
            />
          </div>
          
          {/* Next Image Button */}
          {hasMultipleImages && (
            <button
              onClick={nextImage}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full p-4 z-10 transition-all"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
          
          {/* Image Info Bar */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black bg-opacity-70 text-white px-6 py-3 rounded-lg">
            <p className="font-semibold text-center">{rv.name}</p>
            <p className="text-sm text-center text-gray-300">Stock #{rv.stock}</p>
            {hasMultipleImages && (
              <p className="text-xs text-center text-gray-400 mt-1">
                Image {currentImageIndex + 1} of {allImages.length}
              </p>
            )}
          </div>
          
          {/* Thumbnail Strip (for navigation) */}
          {hasMultipleImages && allImages.length > 1 && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-2 max-w-4xl overflow-x-auto px-4 py-2 bg-black bg-opacity-50 rounded-lg">
              {allImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex(idx);
                  }}
                  className={`relative flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-all ${
                    idx === currentImageIndex ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <Image
                    src={img}
                    alt={`Thumbnail ${idx + 1}`}
                    fill
                    className="object-cover"
                    unoptimized
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )}
  </>
  );
}
