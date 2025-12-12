# Employee RV Purchase Program

A Next.js application providing an exclusive RV purchasing program for employees of participating companies.

## Project Overview

This application allows corporate companies to offer their employees special discounts on a curated selection of RVs through a pre-negotiated pricing model. Employees can:

- Learn about the exclusive program benefits
- Enter their email to gain access to the inventory
- (Future) Browse and purchase from a curated RV inventory
- (Future) Apply exclusive discounts to their purchase

## Features

### Current Implementation

- **Landing Page**: Professional landing page explaining the program benefits
- **Email Signup Form**: Form for employees to request access to the inventory
- **API Endpoint**: Backend endpoint to handle email submissions (`/api/signup`)
- **Responsive Design**: Mobile-friendly design using Tailwind CSS
- **Form Validation**: Email validation on both client and server side

### Planned Features

- Database integration for persistent email storage
- Email confirmation flow with access link generation
- Employee inventory browsing page
- Admin dashboard for managing inventory and access
- Purchase functionality with discount application
- User authentication system

## Getting Started

### Prerequisites

- Node.js 18+ and npm installed

### Installation

Install dependencies:

```bash
npm install
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the landing page.

### Build

Build for production:

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── signup/
│   │       └── route.ts          # Email signup API endpoint
│   ├── layout.tsx                 # Root layout
│   ├── page.tsx                   # Landing page
│   └── globals.css                # Global styles
├── components/
│   └── EmailSignupForm.tsx        # Email signup form component
```

## API Endpoints

### POST `/api/signup`

Submit an email to register for the program.

**Request Body:**
```json
{
  "email": "employee@company.com"
}
```

**Response:**
```json
{
  "message": "Successfully registered! Check your email for access details."
}
```

**Error Responses:**
- 400: Invalid or missing email
- 409: Email already registered
- 500: Server error

### GET `/api/signup`

Check if an email is registered (for testing purposes).

**Query Parameters:**
- `email`: Email address to check

**Response:**
```json
{
  "email": "employee@company.com",
  "isRegistered": true
}
```

## Data Storage

⚠️ **Current Implementation Note**: The application currently uses in-memory storage for email signups. This means all data is lost when the server restarts.

### Next Steps - Database Integration

Before moving to production, implement persistent storage using one of:
- PostgreSQL with Prisma ORM
- MongoDB with Mongoose
- Firebase Firestore
- Supabase

Update the `/api/signup` route to use your chosen database.

## Technology Stack

- **Framework**: Next.js 16 with TypeScript
- **Styling**: Tailwind CSS
- **Database**: (To be implemented)
- **Authentication**: (To be implemented)

## Development Notes

### TODO Items

1. **Database Setup**: Replace in-memory storage with persistent database
2. **Email Service**: Implement email confirmation and access link generation
3. **Authentication**: Add user authentication for inventory access
4. **Inventory Management**: Create admin panel for RV inventory management
5. **Purchase System**: Build purchase flow with discount application
6. **Analytics**: Track signups and user engagement

### Configuration

- **Email Validation**: Simple regex pattern (update as needed)
- **Tailwind Config**: `tailwind.config.ts`
- **TypeScript Config**: `tsconfig.json`

## License

Proprietary - For use by authorized personnel only
