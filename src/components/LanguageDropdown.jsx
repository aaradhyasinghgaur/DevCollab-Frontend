import React, { useState, useRef, useEffect } from 'react';
import { RiArrowDownSLine } from 'react-icons/ri';

const LANGUAGES = [
  { value: 'JAVASCRIPT', name: 'JavaScript', color: 'bg-yellow-400' },
  { value: 'PYTHON', name: 'Python', color: 'bg-emerald-400' },
  { value: 'JAVA', name: 'Java', color: 'bg-amber-500' },
  { value: 'CPP', name: 'C++', color: 'bg-blue-400' },
  { value: 'C', name: 'C', color: 'bg-cyan-400' }
];

const LanguageDropdown = ({ selectedLanguage = 'JAVASCRIPT', onLanguageChange, disabled = false }) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const current = LANGUAGES.find((l) => l.value === selectedLanguage) || LANGUAGES[0];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className="flex items-center gap-2.5 rounded-lg border border-gray-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-gray-700 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        <div className={`h-2.5 w-2.5 rounded-full ${current.color}`}></div>
        <span>{current.name}</span>
        <RiArrowDownSLine
          className={`text-base text-gray-400 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-40 rounded-xl border border-gray-800 bg-slate-900 p-1 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.value}
              onClick={() => {
                onLanguageChange && onLanguageChange(lang.value);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition ${
                lang.value === selectedLanguage
                  ? 'bg-purple-950/60 text-purple-300 font-semibold'
                  : 'text-gray-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className={`h-2.5 w-2.5 rounded-full ${lang.color}`}></div>
              <span>{lang.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageDropdown;