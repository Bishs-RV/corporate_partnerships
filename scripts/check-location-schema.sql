-- First, let's check if the table has zip/address columns with different names
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'location_detail' 
  AND (column_name ILIKE '%zip%' 
       OR column_name ILIKE '%address%' 
       OR column_name ILIKE '%city%' 
       OR column_name ILIKE '%state%'
       OR column_name ILIKE '%postal%');

-- Show a sample row to see what data is available
SELECT * FROM location_detail WHERE location NOT IN('GMI', 'POC', 'COR') LIMIT 1;
