/**
 * Manufacturer Configuration
 * 
 * Defines business rules for manufacturer-specific features and availability.
 * Eventually this will be moved to a database configuration.
 */

export interface ManufacturerConfig {
  name: string;
  deliveryAvailable: boolean;
  pickupAvailable: boolean; // Default true for all
}

/**
 * Manufacturers that support delivery option
 * All manufacturers support pickup by default
 */
const DELIVERY_ENABLED_MANUFACTURERS = [
  'Jayco',
  'Forest River',
];

/**
 * Get delivery availability for a manufacturer
 */
export function isDeliveryAvailable(manufacturer: string): boolean {
  if (!manufacturer) return false;
  return DELIVERY_ENABLED_MANUFACTURERS.some(
    m => m.toLowerCase() === manufacturer.toLowerCase()
  );
}

/**
 * Get pickup availability for a manufacturer (always true currently)
 */
export function isPickupAvailable(manufacturer: string): boolean {
  return true; // All manufacturers support pickup
}

/**
 * Get availability display text
 */
export function getAvailabilityText(manufacturer: string): string {
  const delivery = isDeliveryAvailable(manufacturer);
  const pickup = isPickupAvailable(manufacturer);
  
  if (delivery && pickup) {
    return 'Pickup & Delivery';
  } else if (delivery) {
    return 'Delivery Only';
  } else if (pickup) {
    return 'Pickup Only';
  }
  
  return 'Contact for Availability';
}

/**
 * Get all manufacturer configurations
 */
export function getAllManufacturerConfigs(): ManufacturerConfig[] {
  return DELIVERY_ENABLED_MANUFACTURERS.map(name => ({
    name,
    deliveryAvailable: true,
    pickupAvailable: true,
  }));
}
