// Database inventory types from unit.get_inventory stored procedure
export interface DatabaseInventoryRow {
  inventory_id: number;
  model_id: number;
  make_year_id: number;
  make_id: number;
  manufacturer_id: number;
  year: number;
  manufacturer: string | null;
  make: string | null;
  sub_make: string | null;
  model: string | null;
  class_id: number | null;
  class: string | null;
  condition: string | null;
  condition_id: number | null;
  cmf_id: number | null;
  location: string | null;
  stocknumber: string | null;
  tail_tag: string | null;
  vin: string | null;
  motor_vin: string | null;
  color: string | null;
  color_id: number | null;
  price: string | null; // Numeric returned as string from pg
  requested_date: string | null;
  order_date: string | null;
  offline_date: string | null;
  mfg_order_number: string | null;
  status: string | null;
  status_id: number | null;
  bank_approval_status: string | null;
  bank_status_by: string | null;
  analyst_approval_status: string | null;
  analyst_status_by: string | null;
  rep_data: any; // JSONB
  zone: string | null;
  transportation_company: string | null;
  delivery_status: string | null;
  created_by: string | null;
  retail_customer_id: number | null;
  retail_first_name: string | null;
  retail_last_name: string | null;
  length: string | null; // Numeric
  gvwr: string | null; // Numeric
  uvwr: string | null; // Numeric
  garage_length: string | null; // Numeric
  slide_count: number | null;
  fuel_type: string | null;
  sleep_count: number | null;
  sidewall_construction: string | null;
  axle_count: number | null;
  motorhome_tow_capacity: string | null; // Numeric
  fresh_tank_capacity: string | null; // Numeric
  grey_tank_capacity: string | null; // Numeric
  black_tank_capacity: string | null; // Numeric
  characteristic_type_ids: number[] | null;
  action_type: string | null;
}

// UI-friendly RV type for the portal
export interface RV {
  id: string;
  stock: string;
  name: string;
  year: number;
  type: string;
  price: number;
  description: string;
  length: number;
  weight: number;
  sleeps: number;
  imageUrl: string;
  // Additional attributes
  manufacturer: string;
  make: string;
  model: string;
  vin: string;
  slideCount: number;
  axleCount: number;
  garageLength: number;
  fuelType: string;
  sidewallConstruction: string;
  freshTankCapacity: number;
  greyTankCapacity: number;
  blackTankCapacity: number;
  uvw: number; // Unloaded Vehicle Weight
  location: string;
}

// Transform database row to UI RV type
export function transformInventoryToRV(row: DatabaseInventoryRow): RV {
  // Combine manufacturer, make, sub_make, and model for the full name
  const nameParts = [
    row.manufacturer,
    row.make,
    row.sub_make,
    row.model,
  ].filter(Boolean);
  
  const name = nameParts.join(' ');
  
  // Create a description from available data
  const descriptionParts = [];
  if (row.class) descriptionParts.push(row.class);
  if (row.length) descriptionParts.push(`${row.length}ft long`);
  if (row.sleep_count) descriptionParts.push(`Sleeps ${row.sleep_count}`);
  if (row.gvwr) descriptionParts.push(`GVWR: ${parseFloat(row.gvwr).toLocaleString()} lbs`);
  if (row.slide_count) descriptionParts.push(`${row.slide_count} slide${row.slide_count > 1 ? 's' : ''}`);
  
  const description = descriptionParts.join('. ') + (descriptionParts.length > 0 ? '.' : 'No details available.');
  
  return {
    id: row.inventory_id.toString(),
    stock: row.stocknumber || 'N/A',
    name: name || 'Unknown RV',
    year: row.year || 0,
    type: row.class || 'RV',
    price: row.price ? parseFloat(row.price) : 0,
    description,
    length: row.length ? parseFloat(row.length) : 0,
    weight: row.gvwr ? parseFloat(row.gvwr) : 0,
    sleeps: row.sleep_count || 0,
    imageUrl: '/placeholder-rv.jpg', // Placeholder image
    // Additional attributes
    manufacturer: row.manufacturer || '',
    make: row.make || '',
    model: row.model || '',
    vin: row.vin || '',
    slideCount: row.slide_count || 0,
    axleCount: row.axle_count || 0,
    garageLength: row.garage_length ? parseFloat(row.garage_length) : 0,
    fuelType: row.fuel_type || '',
    sidewallConstruction: row.sidewall_construction || '',
    freshTankCapacity: row.fresh_tank_capacity ? parseFloat(row.fresh_tank_capacity) : 0,
    greyTankCapacity: row.grey_tank_capacity ? parseFloat(row.grey_tank_capacity) : 0,
    blackTankCapacity: row.black_tank_capacity ? parseFloat(row.black_tank_capacity) : 0,
    uvw: row.uvwr ? parseFloat(row.uvwr) : 0,
    location: row.location || '',
  };
}
