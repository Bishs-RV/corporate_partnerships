const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

// Extract all lot IDs from the URL
const lots = [
  231, 1899, 1999, 1225, 1011, 1012, 1304, 1340, 1274, 1275, 1276, 1277, 
  1278, 1279, 1280, 1281, 1282, 1283, 1284, 1285, 1286, 1287, 1367, 1448, 
  1527, 1492, 2303
];

// Location names mapping (you can update these with actual names)
const lotNames = {
  231: 'location-231',
  1899: 'location-1899',
  1999: 'location-1999',
  1225: 'location-1225',
  1011: 'location-1011',
  1012: 'location-1012',
  1304: 'location-1304',
  1340: 'location-1340',
  1274: 'location-1274',
  1275: 'location-1275',
  1276: 'location-1276',
  1277: 'location-1277',
  1278: 'location-1278',
  1279: 'location-1279',
  1280: 'location-1280',
  1281: 'location-1281',
  1282: 'location-1282',
  1283: 'location-1283',
  1284: 'location-1284',
  1285: 'location-1285',
  1286: 'location-1286',
  1287: 'location-1287',
  1367: 'location-1367',
  1448: 'location-1448',
  1527: 'location-1527',
  1492: 'location-1492',
  2303: 'location-2303'
};

// API configuration
const API_CONFIG = {
  accountId: 68,
  token: '6Fo0WXjFGP3kP5die1juig',
  version: 2,
  format: 'json',
  pgIds: [2, 1, 5],
  websiteId: 871
};

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, '..', 'data', 'rv-images');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Function to build URL for a specific lot
function buildUrl(lotId) {
  const params = new URLSearchParams({
    accountId: API_CONFIG.accountId.toString(),
    token: API_CONFIG.token,
    version: API_CONFIG.version.toString(),
    format: API_CONFIG.format,
    websiteId: API_CONFIG.websiteId.toString(),
    lot: lotId.toString()
  });
  
  // Add pgId parameters separately (multiple values)
  API_CONFIG.pgIds.forEach(pgId => {
    params.append('pgId', pgId.toString());
  });
  
  return `https://www.rvonedata.com/feed/export/data?${params.toString()}`;
}

// Function to download JSON for a specific lot with proper headers
function downloadLotData(lotId, retryCount = 0) {
  return new Promise((resolve, reject) => {
    const url = buildUrl(lotId);
    const locationName = lotNames[lotId] || `lot-${lotId}`;
    
    console.log(`Downloading ${locationName} (lot ${lotId})...`);
    
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    };
    
    https.get(url, options, (response) => {
      // Check status code
      if (response.statusCode !== 200) {
        console.error(`✗ HTTP ${response.statusCode} for lot ${lotId}`);
        if (retryCount < 2) {
          console.log(`  Retrying in 3 seconds...`);
          setTimeout(() => {
            downloadLotData(lotId, retryCount + 1).then(resolve).catch(reject);
          }, 3000);
          return;
        }
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      // Handle compressed responses
      let stream = response;
      const encoding = response.headers['content-encoding'];
      
      if (encoding === 'gzip') {
        stream = response.pipe(zlib.createGunzip());
      } else if (encoding === 'br') {
        stream = response.pipe(zlib.createBrotliDecompress());
      } else if (encoding === 'deflate') {
        stream = response.pipe(zlib.createInflate());
      }
      
      const chunks = [];
      
      stream.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      stream.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf8');
        try {
          // Verify it's valid JSON
          const parsed = JSON.parse(data);
          
          // Check if it's HTML (Cloudflare block)
          if (data.trim().startsWith('<!DOCTYPE') || data.trim().startsWith('<html')) {
            throw new Error('Received HTML instead of JSON (possible Cloudflare block)');
          }
          
          // Save to file with location name
          const filePath = path.join(dataDir, `${locationName}.json`);
          fs.writeFileSync(filePath, data, 'utf8');
          
          // Count units
          let unitCount = 0;
          if (parsed.locations && Array.isArray(parsed.locations)) {
            parsed.locations.forEach(loc => {
              if (loc.units) unitCount += loc.units.length;
            });
          }
          
          console.log(`✓ Saved ${locationName} - ${unitCount} units (${(data.length / 1024).toFixed(0)} KB)`);
          resolve({ lotId, locationName, unitCount, size: data.length });
        } catch (error) {
          console.error(`✗ Error for lot ${lotId}:`, error.message);
          
          // Save error response for debugging
          if (data.length > 0 && data.length < 50000) {
            const debugPath = path.join(dataDir, `${locationName}-error.txt`);
            fs.writeFileSync(debugPath, data.substring(0, 2000), 'utf8');
            console.error(`   Saved error response to ${debugPath}`);
          }
          
          if (retryCount < 2) {
            console.log(`  Retrying in 5 seconds...`);
            setTimeout(() => {
              downloadLotData(lotId, retryCount + 1).then(resolve).catch(reject);
            }, 5000);
          } else {
            reject(error);
          }
        }
      });
    }).on('error', (error) => {
      console.error(`✗ Network error for lot ${lotId}:`, error.message);
      if (retryCount < 2) {
        console.log(`  Retrying in 5 seconds...`);
        setTimeout(() => {
          downloadLotData(lotId, retryCount + 1).then(resolve).catch(reject);
        }, 5000);
      } else {
        reject(error);
      }
    });
  });
}

// Download all lots sequentially with a delay between requests
async function downloadAll() {
  console.log(`\n=== RV Image Data Downloader ===\n`);
  console.log(`Starting download of ${lots.length} locations...\n`);
  
  const results = {
    successful: [],
    failed: [],
    totalUnits: 0,
    totalSize: 0
  };
  
  for (let i = 0; i < lots.length; i++) {
    const lotId = lots[i];
    const progress = `[${i + 1}/${lots.length}]`;
    
    try {
      console.log(`${progress} Processing lot ${lotId}...`);
      const result = await downloadLotData(lotId);
      results.successful.push(result);
      results.totalUnits += result.unitCount;
      results.totalSize += result.size;
      
      // Delay between requests to avoid overwhelming the server
      if (i < lots.length - 1) {
        const delay = 2000; // 2 seconds between requests
        console.log(`   Waiting ${delay / 1000}s before next request...\n`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.error(`${progress} ✗ Failed to download lot ${lotId}: ${error.message}\n`);
      results.failed.push({ lotId, error: error.message });
    }
  }
  
  // Print summary
  console.log(`\n=== Download Summary ===\n`);
  console.log(`Successful: ${results.successful.length}/${lots.length}`);
  console.log(`Failed: ${results.failed.length}/${lots.length}`);
  console.log(`Total RV units: ${results.totalUnits}`);
  console.log(`Total data size: ${(results.totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`\nFiles saved to: ${dataDir}`);
  
  if (results.failed.length > 0) {
    console.log(`\n=== Failed Downloads ===`);
    results.failed.forEach(f => {
      console.log(`  Lot ${f.lotId}: ${f.error}`);
    });
  }
  
  // Save summary to file
  const summaryPath = path.join(dataDir, 'download-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nSummary saved to: ${summaryPath}`);
}

// Run the download
downloadAll().catch(console.error);
