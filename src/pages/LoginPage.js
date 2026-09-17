import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FcGoogle } from 'react-icons/fc';
import { FaGithub, FaEye, FaEyeSlash } from 'react-icons/fa';
import { FaLock } from 'react-icons/fa6';
import HorizontalPartition from '../components/HorizontalPartition';
import VerticalPartition from '../components/VerticalPartition';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../api/client';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleOAuthLogin = (provider) => {
    window.location.href = `${API_BASE_URL}/oauth2/authorization/${provider}`;
  };

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email.trim() || !formData.password) {
      setError('Please enter both email and password.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await login(formData.email.trim(), formData.password);
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      {/* Left Column: Form */}
      <div className="flex w-full md:w-[42%] lg:w-[40%] items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md">
          {/* Heading */}
          <div className="mb-6">
            <h2 className="mb-2 text-3xl font-bold tracking-tight text-gray-100">
              Welcome Back
            </h2>
            <p className="text-sm text-gray-400">
              Sign in to your DevCollab Workspace
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 rounded-lg border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* OAuth Buttons */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => handleOAuthLogin('google')}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-800 bg-slate-900 py-3 font-semibold text-gray-200 transition duration-200 hover:bg-slate-800 hover:border-gray-700"
            >
              <FcGoogle className="text-xl" />
              <span>Continue with Google</span>
            </button>

            <button
              type="button"
              onClick={() => handleOAuthLogin('github')}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-800 bg-slate-900 py-3 font-semibold text-gray-200 transition duration-200 hover:bg-slate-800 hover:border-gray-700"
            >
              <FaGithub className="text-xl text-white" />
              <span>Continue with GitHub</span>
            </button>
          </div>

          <HorizontalPartition />

          {/* Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="you@example.com"
                className="w-full rounded-lg border border-gray-800 bg-slate-900/90 p-3 text-sm text-white placeholder-gray-500 outline-none transition focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400"
              >
                Password
              </label>
              <div className="relative">
                <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-gray-800 bg-slate-900/90 py-3 pl-9 pr-10 text-sm text-white placeholder-gray-500 outline-none transition focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                  tabIndex={-1}
                >
                  {showPassword ? <FaEye className="text-base" /> : <FaEyeSlash className="text-base" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-lg bg-purple-700 py-3 font-semibold text-white transition duration-200 hover:bg-purple-600 disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-purple-950/40"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  <span>Signing In...</span>
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Switch to Register */}
          <p className="mt-6 text-center text-sm text-gray-400">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="font-semibold text-purple-400 transition hover:text-purple-300 hover:underline"
            >
              Create Account
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden md:block">
        <VerticalPartition />
      </div>

      {/* Right Column: Hero Banner */}
      <div className="hidden md:flex flex-1 flex-col justify-between p-12 bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950/30">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600/30 border border-purple-500/30 text-purple-400 font-bold text-lg">
            {'</>'}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">DevCollab</h1>
        </div>

        <div className="max-w-md my-auto">
          <div className="inline-block rounded-full bg-purple-900/40 border border-purple-700/40 px-3.5 py-1 text-xs font-semibold text-purple-300 mb-4">
            Real-Time Collaborative IDE
          </div>
          <h1 className="text-4xl font-extrabold leading-tight text-white mb-3">
            Code together, <br />
            <span className="text-purple-400">ship faster.</span>
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            Experience conflict-free simultaneous editing, live terminal execution, and in-room team chat powered by Operational Transformation and WebSockets.
          </p>
        </div>

        <div className="text-xs text-gray-500">
          © {new Date().getFullYear()} DevCollab Inc. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
