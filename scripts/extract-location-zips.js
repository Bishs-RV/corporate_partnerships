const fs = require('fs');
const path = require('path');

// Parse all location JSON files to extract zip codes
function extractZipCodes() {
  const dataDir = path.join(__dirname, '..', 'data', 'rv-images');
  const files = fs.readdirSync(dataDir).filter(f => f.startsWith('location-') && f.endsWith('.json'));
  
  const zipCodeMap = {};
  
  for (const file of files) {
    try {
      const filePath = path.join(dataDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      
      if (data.locations && data.locations.length > 0) {
        for (const location of data.locations) {
          const lotId = location.id;
          const zip = location.zip;
          const name = location.name;
          const city = location.city;
          const state = location.state;
          
          if (lotId && zip) {
            zipCodeMap[lotId] = {
              zip,
              name,
              city,
              state,
              lotId
            };
            console.log(`${lotId}: '${zip}', // ${name}, ${city}, ${state}`);
          }
        }
      }
    } catch (error) {
      console.error(`Error parsing ${file}:`, error.message);
    }
  }
  
  console.log('\n\nTypeScript export:');
  console.log('export const LOCATION_ZIP_CODES: Record<number, string> = {');
  Object.entries(zipCodeMap).forEach(([lotId, data]) => {
    console.log(`  ${lotId}: '${data.zip}', // ${data.name}, ${data.city}, ${data.state}`);
  });
  console.log('};');
}

extractZipCodes();
