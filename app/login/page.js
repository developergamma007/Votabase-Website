'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginRegisterLight() {
  const [mode, setMode] = useState('login'); // login | register
  const [formData, setFormData] = useState({ userName: "", password: "" });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(
        `http://api.iswot.in:8081/votebase/v1/api/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userName: formData.userName,
            password: formData.password,
          }),
        }
      );

      if (!response.ok) throw new Error("Invalid username or password");

      const data = await response.json();
      const result = data?.data?.result;

      if (!result?.token) throw new Error("Invalid response from server");

      localStorage.setItem("token", result.token);
      localStorage.setItem("role", result.role);
      localStorage.setItem("userName", result.userName);
      localStorage.setItem("tenantId", result.tenantId || "");

      if (result.role === "SUPER_ADMIN") router.push("/tenants");
      else if (result.role === "ADMIN") router.push("/dashboard");
      else router.push("/login");
    } catch (err) {
      alert(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-300 via-blue-300 to-blue-900">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl px-10 py-10">
        {/* Title */}
        <h3 className="text-2xl font-semibold text-black-700 text-center">
          {mode === 'login' ? 'Admin Login' : 'Admin Register'}
        </h3>

        {/* Toggle */}
        <div className="flex mt-5 bg-blue-100 rounded-full p-1">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`w-1/2 py-2 rounded-full text-sm font-medium transition ${
              mode === 'login'
                ? 'bg-white text-blue-700 shadow'
                : 'text-blue-600'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`w-1/2 py-2 rounded-full text-sm font-medium transition ${
              mode === 'register'
                ? 'bg-white text-blue-700 shadow'
                : 'text-blue-600'
            }`}
          >
            Register
          </button>
        </div>

        {/* Form */}
        <form className="mt-5 space-y-6" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName || ''}
                onChange={handleChange}
                placeholder="Enter full name"
                className="w-full h-12 px-4 rounded-lg border border-gray-200
                           focus:outline-none focus:ring-2 focus:ring-blue-500
                           focus:border-blue-500 transition"
              />
            </div>
          )}

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              type="text"
              name="userName"
              value={formData.userName}
              onChange={handleChange}
              placeholder="Enter username"
              className="w-full h-12 px-4 rounded-lg border border-gray-200
                         focus:outline-none focus:ring-2 focus:ring-blue-500
                         focus:border-blue-500 transition"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter password"
              className="w-full h-12 px-4 rounded-lg border border-gray-200
                         focus:outline-none focus:ring-2 focus:ring-blue-500
                         focus:border-blue-500 transition"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword || ''}
                onChange={handleChange}
                placeholder="Confirm password"
                className="w-full h-12 px-4 rounded-lg border border-gray-200
                           focus:outline-none focus:ring-2 focus:ring-blue-500
                           focus:border-blue-500 transition"
              />
            </div>
          )}

          {/* Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-lg bg-blue-600
                       hover:bg-blue-700 text-white font-semibold
                       transition shadow-md disabled:opacity-50"
          >
            {loading ? "Please wait..." : mode === 'login' ? 'Login' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  );
}
