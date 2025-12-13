// This file maps RV stock numbers to their image URLs from the RVOneData feed
import imageMapping from '../../data/rv-images/image-mapping.json';

export interface RVImageData {
  description: string;
  year: number | null;
  manufacturer: string;
  make: string;
  model: string;
  isNew: boolean;
  price: number;
  images: string[];
  primaryImage: string;
  itemDetailUrl: string;
}

/**
 * Get image data for an RV by stock number
 * @param stockNumber The RV stock number
 * @returns Image data if found, undefined otherwise
 */
export function getRVImages(stockNumber: string): RVImageData | undefined {
  if (!stockNumber) return undefined;
  
  const mapping = imageMapping as Record<string, RVImageData>;
  
  // Clean up stock number (remove spaces, convert to uppercase, etc.)
  const cleanStock = stockNumber.toString().trim().toUpperCase();
  
  // Try exact match first
  if (mapping[stockNumber]) {
    return mapping[stockNumber];
  }
  
  // Try cleaned version
  if (mapping[cleanStock]) {
    return mapping[cleanStock];
  }
  
  // Try case-insensitive search
  const keys = Object.keys(mapping);
  const matchingKey = keys.find(key => 
    key.toString().trim().toUpperCase() === cleanStock
  );
  
  if (matchingKey) {
    return mapping[matchingKey];
  }
  
  return undefined;
}

/**
 * Get the primary (first) image URL for an RV
 * @param stockNumber The RV stock number
 * @returns Primary image URL or undefined if not found
 */
export function getPrimaryImage(stockNumber: string): string | undefined {
  const imageData = getRVImages(stockNumber);
  return imageData?.primaryImage;
}

/**
 * Get all image URLs for an RV
 * @param stockNumber The RV stock number
 * @returns Array of image URLs or empty array if not found
 */
export function getAllImages(stockNumber: string): string[] {
  const imageData = getRVImages(stockNumber);
  return imageData?.images || [];
}

/**
 * Check if an RV has images available
 * @param stockNumber The RV stock number
 * @returns True if images are available, false otherwise
 */
export function hasImages(stockNumber: string): boolean {
  const imageData = getRVImages(stockNumber);
  return imageData !== undefined && imageData.images.length > 0;
}

/**
 * Get the detail page URL for an RV
 * @param stockNumber The RV stock number
 * @returns Detail URL or undefined if not found
 */
export function getDetailUrl(stockNumber: string): string | undefined {
  const imageData = getRVImages(stockNumber);
  return imageData?.itemDetailUrl;
}

// Export the raw mapping for advanced use cases
export { imageMapping };
