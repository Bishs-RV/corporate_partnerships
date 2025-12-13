# Database Integration Setup

## Overview
This app now connects to a PostgreSQL database to fetch real RV inventory data from Bish's system.

## Setup Instructions

### 1. Environment Variables
Copy `.env.local.example` to `.env.local` and update with your database credentials:

```env
DATABASE_HOST=development-test.cdyzkfxmqyqc.us-west-2.rds.amazonaws.com
DATABASE_PORT=5432
DATABASE_NAME=moneyBall_DB
DATABASE_USER=cjohnson
DATABASE_PASSWORD=your_password_here
KIEWIT_LOCATION_CMF_ID=76179597
```

**IMPORTANT**: Replace `your_password_here` with your actual database password.

### 2. Dependencies
The required PostgreSQL library has been installed:
- `pg` - PostgreSQL client for Node.js
- `@types/pg` - TypeScript types for pg

### 3. Database Connection
- Connection pooling is configured in `src/lib/db.ts`
- The pool is reused across requests for efficiency
- Maximum 20 connections with 30-second idle timeout

## API Endpoints

### GET `/api/inventory`
Fetches RV inventory from the database.

**Filters Applied:**
- Location: IDF (CMF ID: 76179597) - for Kiewit partnership
- Condition: New units only
- Includes characteristic data (specs like sleep count, length, etc.)

**Response:**
```json
{
  "success": true,
  "count": 50,
  "data": [
    {
      "id": "12345",
      "stock": "96054",
      "name": "FOREST RIVER TIMBERWOLF 27MDK",
      "year": 2025,
      "type": "DT",
      "price": 45000,
      "description": "...",
      "length": 27,
      "weight": 6000,
      "sleeps": 4,
      "imageUrl": "/placeholder-rv.svg"
    }
  ]
}
```

## Data Transformation

### Database Fields → UI Fields
- `stocknumber` → `stock`
- `manufacturer + make + sub_make + model` → `name`
- `class` → `type`
- `gvwr` → `weight` (Gross Vehicle Weight Rating)
- `sleep_count` → `sleeps`
- `length` → `length`
- `price` → `price` (with 15% Kiewit discount applied in UI)

## Stored Procedure
The app calls `unit.get_inventory()` which supports:
- Multiple filter parameters (year, manufacturer, make, model, etc.)
- Conditional data inclusion
- Server-side filtering

## Current Implementation
**Client-Side Filtering**: The app fetches all inventory at once and filters by type on the client. This is suitable for datasets under 1000 records.

## Future Enhancements
1. **Server-Side Pagination**: For larger datasets, implement pagination in the API route
2. **Additional Filters**: Add UI controls for year, manufacturer, price range
3. **Real Images**: Replace placeholder SVG with actual RV photos
4. **Caching**: Implement API response caching to reduce database load

## Testing

### 1. Check Database Connection
Visit: `http://localhost:3000/api/inventory`

**Expected**: JSON response with inventory data
**If error**: Check .env.local credentials and database connectivity

### 2. View Portal
1. Sign up with a Kiewit email
2. Verify PIN
3. View inventory on portal page

## Troubleshooting

### "Failed to fetch inventory"
- Verify database credentials in `.env.local`
- Check database server is accessible
- Verify stored procedure `unit.get_inventory` exists

### No inventory displayed
- Check if there are "New" condition units at IDF location (CMF ID: 76179597)
- Review API response in browser console

### TypeScript errors
- Run `npm install` to ensure all dependencies are installed
- Check that type definitions match database schema

## Security Notes
- Never commit `.env.local` to version control
- Database credentials should be kept secure
- Consider using read-only database user for the portal
- Implement rate limiting on API endpoints for production
