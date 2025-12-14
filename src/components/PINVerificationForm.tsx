'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface PINVerificationFormProps {
  email: string;
  onBack: () => void;
}

export default function PINVerificationForm({ email, onBack }: PINVerificationFormProps) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // For prototype: verify PIN using localStorage
      const storedPIN = localStorage.getItem('lastPIN');
      const storedEmail = localStorage.getItem('lastEmail');
      const pinExpiry = localStorage.getItem('pinExpiry');

      // Check if PIN matches
      if (pin !== storedPIN) {
        throw new Error('Invalid PIN. Please try again.');
      }

      // Check if email matches
      if (email.toLowerCase() !== storedEmail?.toLowerCase()) {
        throw new Error('Email mismatch. Please start over.');
      }

      // Check if PIN is expired
      if (pinExpiry && new Date() > new Date(pinExpiry)) {
        throw new Error('PIN has expired. Please request a new one.');
      }

      // Store email in session/localStorage for portal access
      localStorage.setItem('userEmail', email);
      localStorage.setItem('verified', 'true');
      
      // Clear the PIN after successful verification
      localStorage.removeItem('lastPIN');
      localStorage.removeItem('pinExpiry');

      // Redirect to portal
      router.push('/portal');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-6">
        <p className="text-gray-600 text-center mb-4">
          We've sent a PIN to <strong>{email}</strong>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="pin" className="text-sm font-medium text-gray-700">
            Enter Your PIN
          </label>
          <input
            type="text"
            id="pin"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            required
            className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest"
          />
          <p className="text-xs text-gray-500 mt-1">
            PIN expires in 15 minutes
          </p>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !pin}
          className="w-full px-6 py-3 bg-[#B43732] text-white text-xs font-bold uppercase tracking-wide rounded hover:bg-[#9A2F2B] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Verifying...' : 'Verify PIN'}
        </button>

        <button
          type="button"
          onClick={onBack}
          className="w-full px-6 py-3 bg-gray-200 text-gray-900 font-semibold rounded-lg hover:bg-gray-300 transition-colors duration-200"
        >
          Back
        </button>
      </form>
    </div>
  );
}
