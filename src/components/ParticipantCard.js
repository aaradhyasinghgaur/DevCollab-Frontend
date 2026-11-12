import React from 'react';
import { TbCrownFilled } from 'react-icons/tb';
import { FiEdit3, FiEye, FiUserX } from 'react-icons/fi';

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
    badge: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
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

const ParticipantCard = ({ participant, isOwner = false, currentUserId = null, onKick }) => {
  if (!participant) return null;

  const name = participant.displayName || participant.userName || participant.username || 'Collaborator';
  const initial = name.charAt(0).toUpperCase();
  const role = participant.roles || participant.role || 'EDITOR';
  const roleStyle = ROLE_STYLES[role] || ROLE_STYLES.EDITOR;
  const RoleIcon = roleStyle.icon;

  const colorIndex = Math.abs(Number(participant.userId || 0)) % AVATAR_COLORS.length;
  const avatarBg = AVATAR_COLORS[colorIndex];

  const isOnline = participant.online === true;
  const canKick = isOwner && String(participant.userId) !== String(currentUserId) && role !== 'OWNER';

  return (
    <div className={`flex items-center justify-between rounded-xl p-2.5 transition ${isOnline ? 'hover:bg-slate-800/60' : 'opacity-70 hover:bg-slate-850 hover:opacity-90'}`}>
      {/* Left: Avatar & Name */}
      <div className="flex items-center gap-3 min-w-0 pr-2">
        <div className="relative flex-shrink-0">
          <div className={`flex h-9 w-9 items-center justify-center rounded-full ${avatarBg} text-xs font-bold text-white shadow`}>
            {initial}
          </div>
          {/* Online status indicator */}
          <div
            className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-slate-900 ${
              isOnline ? 'bg-emerald-400 shadow-sm shadow-emerald-500/50' : 'bg-slate-600'
            }`}
          ></div>
        </div>

        <div className="min-w-0">
          <span className="block text-xs font-semibold text-gray-200 truncate">
            {name}
          </span>
          <span className={`block text-[10px] ${isOnline ? 'text-emerald-400 font-medium' : 'text-gray-500'}`}>
            {isOnline ? 'Active now' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Right: Role Badge & Kick Button */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${roleStyle.badge}`}>
          <RoleIcon className="text-xs" />
          <span>{roleStyle.label}</span>
        </div>
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
