import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCopy, FiCheck, FiUsers, FiTrash2 } from 'react-icons/fi';
import { TbCrownFilled } from 'react-icons/tb';

const LANGUAGE_STYLES = {
  JAVASCRIPT: { label: 'JavaScript', dot: 'bg-yellow-400', badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  PYTHON: { label: 'Python', dot: 'bg-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  JAVA: { label: 'Java', dot: 'bg-amber-500', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  CPP: { label: 'C++', dot: 'bg-blue-400', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  C: { label: 'C', dot: 'bg-cyan-400', badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' }
};

const AVATAR_COLORS = [
  'bg-purple-600',
  'bg-blue-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-indigo-600'
];

const RoomCard = ({ room, currentUserId, onDelete }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  if (!room) return null;

  const langStyle = LANGUAGE_STYLES[room.language] || {
    label: room.language || 'Code',
    dot: 'bg-gray-400',
    badge: 'bg-gray-500/10 text-gray-400 border-gray-500/20'
  };

  const isOwner = currentUserId && String(room.ownerId) === String(currentUserId);
  const participants = room.participants || [];
  const participantCount = participants.length || 1;
  const roomId = room.roomId || room.id;
  const roomName = room.roomName || room.name;

  const handleCopyCode = (e) => {
    e.stopPropagation();
    if (room.inviteCode) {
      navigator.clipboard.writeText(room.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEnterRoom = () => {
    navigate(`/room/${roomId}`);
  };

  return (
    <div
      onClick={handleEnterRoom}
      className="group relative flex flex-col justify-between w-full max-w-[360px] rounded-2xl border border-gray-800/80 bg-slate-900/80 p-6 shadow-xl backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/40 hover:shadow-2xl hover:shadow-purple-950/20 cursor-pointer"
    >
      <div>
        {/* Top Header: Title & Owner Badge */}
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-xl font-bold tracking-tight text-white group-hover:text-purple-300 transition line-clamp-1">
            {roomName}
          </h2>
          <div className="flex items-center gap-1.5">
            {isOwner ? (
              <span className="flex items-center gap-1 rounded-full bg-purple-950/70 border border-purple-800/50 px-2 py-0.5 text-[11px] font-semibold text-purple-300">
                <TbCrownFilled className="text-xs text-amber-400" />
                Owner
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-slate-800/80 border border-gray-700/50 px-2 py-0.5 text-[11px] font-medium text-gray-400">
                Member
              </span>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(room);
                }}
                title={isOwner ? "Delete room permanently" : "Delete room for yourself"}
                aria-label={isOwner ? "Delete room permanently" : "Delete room for yourself"}
                className="rounded-lg p-1 text-gray-400 hover:bg-rose-950/60 hover:text-rose-400 transition"
              >
                <FiTrash2 className="text-sm" />
              </button>
            )}
          </div>
        </div>

        {/* Language Badge & Invite Code */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${langStyle.badge}`}>
            <div className={`h-2 w-2 rounded-full ${langStyle.dot}`}></div>
            <span>{langStyle.label}</span>
          </div>

          {room.inviteCode && (
            <button
              onClick={handleCopyCode}
              title="Click to copy invite code"
              className="flex items-center gap-1.5 rounded-lg border border-gray-800 bg-slate-950/70 px-2.5 py-1 text-xs font-mono text-gray-400 hover:text-white hover:border-gray-700 transition"
            >
              {copied ? (
                <>
                  <FiCheck className="text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <FiCopy className="text-gray-400" />
                  <span>{room.inviteCode}</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Description */}
        <p className="mt-4 text-sm leading-relaxed text-gray-400 line-clamp-2 min-h-[40px]">
          {room.description || 'Collaborative coding room. Jump in to write, run, and discuss code in real-time.'}
        </p>
      </div>

      {/* Footer: Members Avatars & Enter Button */}
      <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-800/60">
        {/* Members */}
        <div className="flex items-center">
          <div className="flex -space-x-2">
            {participants.slice(0, 3).map((p, idx) => {
              const pName = p.displayName || p.userName || p.username || 'Dev';
              const pInitial = pName.charAt(0).toUpperCase();
              const colorClass = AVATAR_COLORS[idx % AVATAR_COLORS.length];
              return (
                <div
                  key={p.userId || idx}
                  title={pName}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-900 ${colorClass} text-xs font-bold text-white shadow`}
                >
                  {pInitial}
                </div>
              );
            })}
            {participants.length === 0 && (
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-900 bg-purple-600 text-xs font-bold text-white shadow">
                {room.ownerName ? room.ownerName.charAt(0).toUpperCase() : 'O'}
              </div>
            )}
          </div>

          <span className="ml-2.5 flex items-center gap-1 text-xs font-medium text-gray-400">
            <FiUsers className="text-xs" />
            <span>{participantCount} {participantCount === 1 ? 'Member' : 'Members'}</span>
          </span>
        </div>

        {/* Action Button */}
        <button
          onClick={handleEnterRoom}
          className="rounded-lg bg-purple-700 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-purple-600"
        >
          Open Room
        </button>
      </div>
    </div>
  );
};

export default RoomCard;
