const fs = require('fs');
const path = require('path');

// Directory containing downloaded JSON files
const dataDir = path.join(__dirname, '..', 'data', 'rv-images');

// Extract stock numbers and image URLs from all locations
const imageMapping = {};
let totalUnits = 0;
let unitsWithImages = 0;
let totalImages = 0;
let filesProcessed = 0;

// Function to process a single JSON file
function processJsonFile(filePath) {
  try {
    const rawData = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(rawData);
    
    const fileName = path.basename(filePath);
    console.log(`Processing ${fileName}...`);
    
    let fileUnits = 0;
    let fileImages = 0;
    
    // The structure is: data.locations[].units[]
    if (data.locations && Array.isArray(data.locations)) {
      data.locations.forEach(location => {
        if (location.units && Array.isArray(location.units)) {
          location.units.forEach(item => {
            if (item.stockNumber) {
              const stockNumber = item.stockNumber.toString().trim();
              totalUnits++;
              fileUnits++;
              
              // Find all Unit Photo assets
              const photoAssets = item.assets?.filter(asset => asset.assetType === 'Unit Photo') || [];
              
              if (photoAssets.length > 0) {
                unitsWithImages++;
                totalImages += photoAssets.length;
                fileImages += photoAssets.length;
                
                // Get all image URLs
                const imageUrls = photoAssets.map(asset => asset.url).filter(url => url);
                
                if (imageUrls.length > 0) {
                  imageMapping[stockNumber] = {
                    description: item.description || '',
                    year: item.year || null,
                    manufacturer: item.manufacturer || '',
                    make: item.make || '',
                    model: item.model || '',
                    isNew: item.isNew || false,
                    price: item.prices?.sales || 0,
                    images: imageUrls,
                    primaryImage: imageUrls[0], // First image as primary
                    itemDetailUrl: item.itemDetailUrl || ''
                  };
                }
              }
            }
          });
        }
      });
    }
    
    console.log(`  ${fileUnits} units, ${fileImages} images`);
    filesProcessed++;
    return true;
  } catch (error) {
    console.error(`Error processing ${path.basename(filePath)}: ${error.message}`);
    return false;
  }
}

// Read all JSON files from the data directory
const files = fs.readdirSync(dataDir);
const jsonFiles = files.filter(f => f.endsWith('.json') && !f.includes('mapping') && !f.includes('summary'));

console.log(`\n=== RV Image Parser ===\n`);
console.log(`Found ${jsonFiles.length} JSON files to process\n`);

// Process each JSON file
jsonFiles.forEach(file => {
  const filePath = path.join(dataDir, file);
  processJsonFile(filePath);
});

// Save the mapping to a JSON file
const outputPath = path.join(dataDir, 'image-mapping.json');
fs.writeFileSync(outputPath, JSON.stringify(imageMapping, null, 2), 'utf8');

// Generate summary report
console.log(`\n=== Summary ===\n`);
console.log(`Files processed: ${filesProcessed}/${jsonFiles.length}`);
console.log(`Total units in inventory: ${totalUnits}`);
console.log(`Units with images: ${unitsWithImages}`);
console.log(`Units without images: ${totalUnits - unitsWithImages}`);
console.log(`Total images: ${totalImages}`);
console.log(`Average images per unit (with images): ${(totalImages / unitsWithImages).toFixed(1)}`);
console.log(`\nImage mapping saved to: ${outputPath}`);
console.log(`Total stock numbers in mapping: ${Object.keys(imageMapping).length}`);

// Show sample entries
console.log(`\n=== Sample Entries ===\n`);
const sampleKeys = Object.keys(imageMapping).slice(0, 5);
sampleKeys.forEach(stock => {
  const item = imageMapping[stock];
  console.log(`Stock: ${stock}`);
  console.log(`  ${item.year} ${item.make} ${item.model}`);
  console.log(`  ${item.images.length} photos, Price: $${item.price.toFixed(2)}`);
  console.log('');
});
