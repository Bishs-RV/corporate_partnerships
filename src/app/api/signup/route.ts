import { NextRequest, NextResponse } from 'next/server';
import { generatePIN, storePIN, getPINRecord } from '@/lib/pinStorage';

// Simple in-memory storage for registered emails
// TODO: Replace with database (e.g., PostgreSQL, MongoDB, etc.)
const registeredEmails = new Set<string>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase();

    // Validate Kiewit email domain
    if (!emailLower.endsWith('@kiewit.com')) {
      return NextResponse.json(
        { error: 'Please use your Kiewit company email address (@kiewit.com)' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLower)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    // Check if email already has a valid PIN
    const existingRecord = getPINRecord(emailLower);
    if (existingRecord && !existingRecord.used && new Date() < existingRecord.expiresAt) {
      return NextResponse.json(
        { error: 'A PIN has already been sent to this email. Check your inbox.' },
        { status: 409 }
      );
    }

    // Generate PIN
    const pin = generatePIN();
    storePIN(emailLower, pin);

    // TODO: Send email with PIN
    // For now, log it (in production, use Sendgrid, AWS SES, etc.)
    console.log(`PIN for ${emailLower}: ${pin}`);

    return NextResponse.json(
      { 
        message: 'Check your email for your access PIN',
        // Remove this in production - only for testing
        testPin: pin
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'An error occurred during signup. Please try again.' },
      { status: 500 }
    );
  }
}
