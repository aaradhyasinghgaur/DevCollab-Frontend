import React, { useState, useRef, useEffect } from 'react';
import LanguageDropdown from './LanguageDropdown';
import { FaPlay } from 'react-icons/fa';
import { RiArrowDownSLine } from 'react-icons/ri';
import { IoMdShare } from 'react-icons/io';
import { FiCheck } from 'react-icons/fi';

const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20, 22];

const EditorNavBar = ({
  fontSize = 14,
  setFontSize,
  language = 'JAVASCRIPT',
  onLanguageChange,
  onRun,
  isRunning = false,
  inviteCode
}) => {
  const [openFontSize, setOpenFontSize] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const fontDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(event.target)) {
        setOpenFontSize(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleShare = () => {
    const url = window.location.href;
    const shareText = inviteCode ? `DevCollab Room Invite Code: ${inviteCode}\nJoin here: ${url}` : url;
    navigator.clipboard.writeText(shareText);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  return (
    <div className="flex h-12 items-center justify-between border-b border-gray-800/80 bg-slate-950 px-3 sm:px-4">
      {/* Left controls: Language & Font Size */}
      <div className="flex items-center gap-3">
        <LanguageDropdown
          selectedLanguage={language}
          onLanguageChange={onLanguageChange}
        />

        {/* Font Size Selector */}
        <div className="relative" ref={fontDropdownRef}>
          <button
            onClick={() => setOpenFontSize(!openFontSize)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-800 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-gray-300 transition hover:border-gray-700"
          >
            <span>{fontSize}px</span>
            <RiArrowDownSLine
              className={`text-sm text-gray-400 transition-transform ${
                openFontSize ? 'rotate-180' : ''
              }`}
            />
          </button>

          {openFontSize && (
            <div className="absolute left-0 top-full mt-1.5 w-24 rounded-xl border border-gray-800 bg-slate-900 p-1 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100">
              {FONT_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => {
                    setFontSize && setFontSize(size);
                    setOpenFontSize(false);
                  }}
                  className={`block w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium transition ${
                    size === fontSize
                      ? 'bg-purple-950/60 text-purple-300 font-semibold'
                      : 'text-gray-300 hover:bg-slate-800'
                  }`}
                >
                  {size}px
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right controls: Run Button & Share Link */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRun}
          disabled={isRunning}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRunning ? (
            <>
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              <span>Running...</span>
            </>
          ) : (
            <>
              <FaPlay className="text-[10px]" />
              <span>Run</span>
            </>
          )}
        </button>

        <button
          onClick={handleShare}
          title="Share room link and invite code"
          className="flex items-center gap-1.5 rounded-lg border border-gray-800 bg-slate-900 p-2 text-xs text-gray-300 hover:border-gray-700 hover:text-white transition"
        >
          {copiedShare ? (
            <FiCheck className="text-emerald-400 text-sm" />
          ) : (
            <IoMdShare className="text-sm" />
          )}
        </button>
      </div>
    </div>
  );
};

export default EditorNavBar;
