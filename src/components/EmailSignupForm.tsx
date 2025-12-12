'use client';

import { useState } from 'react';
import PINVerificationForm from './PINVerificationForm';

export default function EmailSignupForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showPINForm, setShowPINForm] = useState(false);
  const [testPin, setTestPin] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sign up');
      }

      setSuccess(true);
      setTestPin(data.testPin || '');
      
      // Store PIN and email in localStorage for prototype verification
      localStorage.setItem('lastEmail', email);
      localStorage.setItem('lastPIN', data.testPin || '');
      localStorage.setItem('pinExpiry', new Date(Date.now() + 15 * 60 * 1000).toISOString());
      
      setShowPINForm(true);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (showPINForm) {
    return (
      <>
        {testPin && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200">
            <p className="text-sm text-blue-700">
              <strong>Test PIN:</strong> {testPin} (for development only)
            </p>
          </div>
        )}
        <PINVerificationForm 
          email={email || localStorage.getItem('lastEmail') || ''} 
          onBack={() => {
            setShowPINForm(false);
            setSuccess(false);
            setTestPin('');
          }}
        />
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-medium text-gray-700">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              localStorage.setItem('lastEmail', e.target.value);
            }}
            placeholder="your.email@kiewit.com"
            required
            className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            Must be a valid @kiewit.com email address
          </p>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="px-4 py-3 rounded-lg bg-green-50 border border-green-200">
            <p className="text-sm text-green-700">
              Success! Check your email for your PIN.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email}
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
        >
          {loading ? 'Processing...' : 'Get Access to Bishs Inventory'}
        </button>
      </div>
    </form>
  );
}
