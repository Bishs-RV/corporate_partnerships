// Mapping of CMF IDs to zip codes from RVOneData
// This data was extracted from the location JSON files we downloaded
export const LOCATION_ZIP_CODES: Record<number, string> = {
  // From location-231.json (Great Falls, MT)
  76179597: '59404',
  
  // Add more as we identify them from the downloaded JSON files
  // These can be populated by parsing the location data we already have
};

// Temporary fallback for major cities (rough approximations)
// These should be replaced with actual database data
export const FALLBACK_ZIP_CODES: Record<string, string> = {
  'SUT': '84115', // Salt Lake City, Utah
  'AIN': '46835', // Anderson, Indiana
  'CHE': '82007', // Cheyenne, Wyoming
  // Add more as needed
};
