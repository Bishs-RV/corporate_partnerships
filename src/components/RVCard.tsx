import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { RV, GroupedRV } from '@/types/inventory';
import { getPrimaryImage, getAllImages, getDetailUrl } from '@/lib/rvImages';

// Helper function to create URL-friendly model slug
function createModelSlug(rv: RV | GroupedRV): string {
  const parts = [
    rv.manufacturer,
    rv.make,
    rv.model,
    rv.year
  ].filter(Boolean);
  
  return parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

interface RVCardProps {
  rv: GroupedRV;
  discountPercent?: number;
  typeDescription?: string; // Full RV type name
  locations?: Array<{ cmf: number; location: string; storename: string }>;
  distanceInMiles?: number | null; // Distance from user's location (nearest location for grouped RVs)
  locationNames?: string[]; // Location names for tooltip (when multiple locations)
  onBuyNow?: (rv: RV) => void;
  onViewDetails?: (rv: RV) => void;
}

export default function RVCard({ 
  rv, 
  discountPercent = 0.15, // 15% default discount
  typeDescription,
  locations = [],
  distanceInMiles = null,
  locationNames = [],
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
  const [showLocationModal, setShowLocationModal] = useState(false);
  const locationModalRef = useRef<HTMLDivElement>(null);

  // Close location modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showLocationModal && locationModalRef.current && !locationModalRef.current.contains(event.target as Node)) {
        setShowLocationModal(false);
      }
    };

    if (showLocationModal) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showLocationModal]);

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
            {/* Stock Number/Quantity, Location, and Distance */}
            <div className="text-xs text-gray-500 mb-1">
              {rv.quantity > 1 ? (
                <span className="font-semibold text-green-700">{rv.quantity} Available</span>
              ) : (
                rv.stock && rv.stock !== 'N/A' && `Stock #${rv.stock}`
              )}
              {(rv.multipleLocations || locationDisplay) && (
                <span className="relative inline-flex items-center">
                  <span className="mx-1">•</span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setShowLocationModal(!showLocationModal);
                    }}
                    className="inline-flex items-center justify-center w-5 h-5 text-blue-600 hover:text-blue-800 transition-colors mx-1"
                    aria-label="View location"
                    title={rv.multipleLocations ? "Multiple locations available" : "View location"}
                  >
                    {/* Solid waypoint icon */}
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {/* Popover next to button */}
                  {showLocationModal && (
                    <div ref={locationModalRef} className="absolute left-0 top-6 z-50 bg-white rounded shadow-lg border border-gray-200 p-2 min-w-[180px]">
                      <div className="space-y-1">
                        {locationNames && locationNames.length > 0 ? (
                          locationNames.map((name, index) => (
                            <div key={index} className="flex items-center gap-1.5 text-xs">
                              <svg className="w-3 h-3 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span className="text-gray-900">{name}</span>
                            </div>
                          ))
                        ) : locationDisplay ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            <svg className="w-3 h-3 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="text-gray-900">{locationDisplay}</span>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">Location information</p>
                        )}
                      </div>
                    </div>
                  )}
                </span>
              )}
              {distanceInMiles !== null && distanceInMiles !== undefined && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setShowLocationModal(!showLocationModal);
                  }}
                  className="text-blue-600 font-semibold hover:text-blue-800 hover:underline transition-colors cursor-pointer"
                  title="View location"
                >
                  {' '}({distanceInMiles} mi)
                </button>
              )}
            </div>
            <p className="text-sm text-gray-600">
              {rv.year} • {typeDescription || rv.type}
            </p>
            {/* Availability Pills */}
            <div className="flex items-center gap-2 mt-1.5">
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-semibold">Pickup</span>
              </div>
              {rv.deliveryAvailable && (
                <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-semibold">Delivery</span>
                </div>
              )}
            </div>
          </div>
          <div className="bg-red-100 text-red-700 px-3 py-1 rounded text-xs font-bold">
            -{discountLabel}
          </div>
        </div>

        {/* Specs Section */}
        <div className="grid grid-cols-3 gap-2 mb-4 text-xs text-gray-600 border-t border-b py-3">
          <div>
            <p className="font-semibold text-gray-700">Length</p>
            <p>{rv.length > 0 ? `${(rv.length / 12).toFixed(1)}ft` : 'N/A'}</p>
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
        <div className="border-t pt-3 mb-3">
          {/* Purchase Price Comparison */}
          <div className="flex justify-between items-baseline mb-2">
            <div>
              <p className="text-xs text-gray-600 mb-0.5">Your Price</p>
              <p className="text-xl font-bold text-gray-900">${discountedPrice.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-600 mb-0.5">MSRP</p>
              <p className="text-lg text-gray-500 line-through">${rv.price.toLocaleString()}</p>
            </div>
          </div>
          
          {/* Monthly Payment Comparison */}
          <div className="flex justify-between items-baseline mb-2 pb-2 border-b">
            <div>
              <p className="text-xs text-gray-600 mb-0.5">Monthly Payment</p>
              <p className="text-base font-bold text-gray-900">${Math.round(kiewitMonthlyPayment).toLocaleString()}/mo</p>
              <p className="text-[10px] text-gray-500">0% APR • 120 months</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-600 mb-0.5">MSRP Monthly</p>
              <p className="text-base text-gray-500 line-through">${Math.round(calculateMonthlyPayment(rv.price, typicalAPR, financingMonths)).toLocaleString()}/mo</p>
              <p className="text-[10px] text-gray-500">@ 8.99% APR</p>
            </div>
          </div>
          
          {/* Total Savings */}
          <div className="bg-gray-50 border border-gray-300 rounded p-2 mt-2">
            <div className="flex justify-between items-baseline mb-1">
              <p className="text-xs text-gray-600 font-semibold">Total Savings</p>
              <p className="text-lg font-bold text-green-700">${totalSavings.toLocaleString()}</p>
            </div>
            <div className="text-[10px] text-gray-600 space-y-0.5">
              <div className="flex justify-between">
                <span>Bish's Discount:</span>
                <span className="font-semibold text-green-600">${priceSavings.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Kiewit Financing Savings:</span>
                <span className="font-semibold text-green-600">${interestSavings.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mt-auto">
          <Link
            href={`/portal/purchase/${createModelSlug(rv)}`}
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
