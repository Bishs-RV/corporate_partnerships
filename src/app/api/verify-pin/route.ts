import { NextRequest, NextResponse } from 'next/server';
import { verifyPIN } from '@/lib/pinStorage';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, pin } = body;

    // Validate inputs
    if (!email || !pin) {
      return NextResponse.json(
        { error: 'Email and PIN are required' },
        { status: 400 }
      );
    }

    // Verify PIN
    const isValid = verifyPIN(email.toLowerCase(), pin);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid or expired PIN. Please request a new one.' },
        { status: 401 }
      );
    }

    // TODO: Create session/token for user
    // For now, return success
    return NextResponse.json(
      { 
        message: 'PIN verified successfully',
        email: email.toLowerCase(),
        accessGranted: true
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('PIN verification error:', error);
    return NextResponse.json(
      { error: 'An error occurred during verification. Please try again.' },
      { status: 500 }
    );
  }
}
