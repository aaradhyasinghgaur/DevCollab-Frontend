import React, { useState, useRef, useEffect } from 'react';
import { MdOutlineSearch } from 'react-icons/md';
import { RiArrowDropDownLine } from 'react-icons/ri';
import { FiLogOut, FiUser } from 'react-icons/fi';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';

const DashboardNavBar = ({ searchQuery = '', onSearchChange }) => {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = user?.displayName || user?.username || 'Developer';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <nav className="flex h-20 items-center justify-between border-b border-gray-800/80 bg-slate-950 px-6 py-4">
      {/* Brand Logo */}
      <Logo />

      {/* Search Bar */}
      <div className="relative w-72 sm:w-96">
        <MdOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-lg text-gray-400" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
          placeholder="Search rooms by name or language..."
          className="w-full rounded-lg border border-gray-800 bg-slate-900 py-2 pl-10 pr-4 text-sm text-gray-200 placeholder-gray-500 outline-none transition focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
        />
      </div>

      {/* User Profile & Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-slate-900 focus:outline-none"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-700 font-bold text-white shadow-md shadow-purple-900/30">
            {initial}
          </div>

          <div className="hidden text-left sm:block">
            <span className="block text-sm font-semibold text-gray-200">
              {displayName}
            </span>
            <span className="block text-xs text-gray-400">
              {user?.role || 'DEVELOPER'}
            </span>
          </div>

          <RiArrowDropDownLine
            className={`text-2xl text-gray-400 transition-transform ${
              dropdownOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-800 bg-slate-900 p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
            <div className="border-b border-gray-800 px-3 py-2">
              <p className="text-xs text-gray-400">Signed in as</p>
              <p className="truncate text-sm font-semibold text-white">
                {user?.email || displayName}
              </p>
            </div>

            <div className="py-1">
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400">
                <FiUser className="text-sm" />
                <span>Username: @{user?.username || 'user'}</span>
              </div>
            </div>

            <div className="border-t border-gray-800 pt-1">
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-400 hover:bg-rose-950/40 transition"
              >
                <FiLogOut className="text-sm" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default DashboardNavBar;
