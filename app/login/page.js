'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { mobileApi } from '../lib/mobileApi';

export default function LoginPage() {
  const [formData, setFormData] = useState({ firstName: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.firstName.trim() || !formData.phone.trim()) {
      setError('Please enter first name and mobile number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await mobileApi.loginApi({
        firstName: formData.firstName.trim(),
        phone: formData.phone.trim(),
      });
      const result = data?.data?.result;

      if (!data?.success || !result?.token) {
        const message =
          data?.detail ||
          data?.message ||
          data?.error ||
          'Invalid first name or mobile number';
        throw new Error(message);
      }

      localStorage.setItem('token', result.token);
      localStorage.setItem('X_INIT_TOKEN', result.token);
      localStorage.setItem('role', result.role || '');
      localStorage.setItem('userName', result.userName || result.firstName || formData.firstName.trim());
      localStorage.setItem('tenantId', result.tenantId || '');
      localStorage.setItem('userInfo', JSON.stringify(result));
      document.cookie = `token=${result.token}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;

      router.push('/mobile/search-voter');
    } catch (err) {
      setError(err?.detail || err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(160deg,#0C7BB3_0%,#0796A1_100%)] px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[380px] rounded-[24px] bg-[#4fa3c7] px-6 py-6 shadow-2xl"
      >
        <h1 className="mb-8 text-center text-3xl font-bold text-white">Votabase</h1>

        <label className="mb-1 block text-sm text-white">First Name</label>
        <input
          type="text"
          name="firstName"
          value={formData.firstName}
          onChange={handleChange}
          placeholder="First Name"
          className="mb-5 h-[38px] border-0 bg-[#6bb6d6] px-4 text-white placeholder:text-[#d0e7f2] focus:ring-2 focus:ring-white/40"
        />

        <label className="mb-1 block text-sm text-white">Mobile Number</label>
        <input
          type="tel"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          placeholder="Mobile Number"
          maxLength={10}
          className="mb-6 h-[38px] border-0 bg-[#6bb6d6] px-4 text-white placeholder:text-[#d0e7f2] focus:ring-2 focus:ring-white/40"
        />

        {error && <p className="mb-3 text-center text-sm font-medium text-white bg-red-600 p-1 rounded ">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mb-5 w-full rounded-lg bg-blue-600 py-3 text-base font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Please wait...' : 'Login'}
        </button>

        <p className="text-center text-xs text-[#e0f1f8]">
          By continuing you agree to our <span className="underline">Terms &amp; Privacy</span>
        </p>
      </form>
    </div>
  );
}
