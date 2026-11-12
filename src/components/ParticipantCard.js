import React, { useState, useRef, useEffect } from 'react';
import { TbCrownFilled } from 'react-icons/tb';
import { FiEdit3, FiEye, FiUserX, FiChevronDown, FiCheck } from 'react-icons/fi';

const ROLE_STYLES = {
  OWNER: {
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    icon: TbCrownFilled,
    label: 'Owner'
  },
  EDITOR: {
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    icon: FiEdit3,
    label: 'Editor'
  },
  VIEWER: {
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    icon: FiEye,
    label: 'Viewer'
  }
};

const AVATAR_COLORS = [
  'bg-purple-700',
  'bg-blue-700',
  'bg-emerald-700',
  'bg-amber-700',
  'bg-rose-700'
];

export const formatLastActive = (lastSeenAt) => {
  if (!lastSeenAt) return 'Last active recently';
  try {
    const date = new Date(lastSeenAt);
    if (isNaN(date.getTime())) return 'Last active recently';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    if (diffMs < 0 || diffMs < 60_000) {
      return 'Last active just now';
    }

    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 60) {
      return `Last active ${diffMins}m ago`;
    }

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `Last active ${diffHours}h ago`;
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) {
      return 'Last active yesterday';
    }
    if (diffDays < 7) {
      return `Last active ${diffDays}d ago`;
    }

    return `Last active ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  } catch (e) {
    return 'Last active recently';
  }
};

const ParticipantCard = ({
  participant,
  isOwner = false,
  currentUserId = null,
  onKick,
  onUpdateRole
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  if (!participant) return null;

  const name = participant.displayName || participant.userName || participant.username || 'Collaborator';
  const initial = name.charAt(0).toUpperCase();
  const rawRole = participant.roles || participant.role || 'EDITOR';
  const role = String(rawRole).toUpperCase();
  const roleStyle = ROLE_STYLES[role] || ROLE_STYLES.EDITOR;
  const RoleIcon = roleStyle.icon;

  const colorIndex = Math.abs(Number(participant.userId || 0)) % AVATAR_COLORS.length;
  const avatarBg = AVATAR_COLORS[colorIndex];

  const isOnline = participant.online === true;
  const isSelf = String(participant.userId) === String(currentUserId);
  const canKick = isOwner && !isSelf && role !== 'OWNER';
  const canChangeRole = isOwner && !isSelf && role !== 'OWNER';

  const handleSelectRole = async (newRole) => {
    if (newRole === role || updating) {
      setDropdownOpen(false);
      return;
    }
    setUpdating(true);
    try {
      if (onUpdateRole) {
        await onUpdateRole(participant.userId, newRole);
      }
    } finally {
      setUpdating(false);
      setDropdownOpen(false);
    }
  };

  return (
    <div
      className={`relative flex items-center justify-between rounded-xl p-2.5 transition ${
        isOnline ? 'hover:bg-slate-800/60' : 'opacity-75 hover:bg-slate-850 hover:opacity-95'
      }`}
    >
      {/* Left: Avatar & Name */}
      <div className="flex items-center gap-3 min-w-0 pr-2">
        <div className="relative flex-shrink-0">
          <div className={`flex h-9 w-9 items-center justify-center rounded-full ${avatarBg} text-xs font-bold text-white shadow`}>
            {initial}
          </div>
          {/* Online status indicator */}
          <div
            className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-slate-900 ${
              isOnline ? 'bg-emerald-400 shadow-sm shadow-emerald-500/50 animate-pulse' : 'bg-slate-600'
            }`}
          ></div>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="block text-xs font-semibold text-gray-200 truncate">
              {name}
            </span>
            {isSelf && (
              <span className="rounded bg-slate-800 px-1 py-0.2 text-[9px] text-gray-400 font-normal">
                You
              </span>
            )}
          </div>
          <span className={`block text-[10px] ${isOnline ? 'text-emerald-400 font-medium' : 'text-gray-400'}`}>
            {isOnline ? 'Active now' : formatLastActive(participant.lastSeenAt)}
          </span>
        </div>
      </div>

      {/* Right: Role Badge (Quick Changer if Owner) & Kick Button */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {canChangeRole ? (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              disabled={updating}
              onClick={() => setDropdownOpen((prev) => !prev)}
              title="Click to change access right"
              className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition hover:brightness-125 focus:outline-none cursor-pointer ${
                roleStyle.badge
              } ${updating ? 'opacity-50 cursor-wait' : ''}`}
            >
              {updating ? (
                <div className="h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent" />
              ) : (
                <RoleIcon className="text-xs" />
              )}
              <span>{roleStyle.label}</span>
              <FiChevronDown className={`text-[10px] transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-36 rounded-lg border border-gray-700 bg-slate-950 p-1 shadow-xl z-50 animate-in fade-in zoom-in-95">
                <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-800">
                  Access Rights
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectRole('EDITOR')}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition ${
                    role === 'EDITOR'
                      ? 'bg-purple-500/20 text-purple-300 font-semibold'
                      : 'text-gray-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <FiEdit3 className="text-purple-400 text-xs" />
                    <span>Editor</span>
                  </div>
                  {role === 'EDITOR' && <FiCheck className="text-purple-400 text-xs" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectRole('VIEWER')}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition ${
                    role === 'VIEWER'
                      ? 'bg-blue-500/20 text-blue-300 font-semibold'
                      : 'text-gray-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <FiEye className="text-blue-400 text-xs" />
                    <span>Viewer</span>
                  </div>
                  {role === 'VIEWER' && <FiCheck className="text-blue-400 text-xs" />}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${roleStyle.badge}`}>
            <RoleIcon className="text-xs" />
            <span>{roleStyle.label}</span>
          </div>
        )}

        {canKick && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onKick) onKick(participant.userId, name);
            }}
            title={`Kick ${name} from room`}
            className="flex items-center gap-1 rounded-md border border-rose-900/60 bg-rose-950/40 px-2 py-0.5 text-[10px] font-semibold text-rose-400 transition hover:bg-rose-900/70 hover:text-rose-200"
          >
            <FiUserX className="text-xs" />
            <span>Kick</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default ParticipantCard;
