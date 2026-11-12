import React, { useMemo } from 'react';
import ParticipantCard from './ParticipantCard';
import { FiUsers } from 'react-icons/fi';

const ParticipantPanel = ({
  participants = [],
  isOwner = false,
  currentUserId = null,
  onKick,
  onUpdateRole
}) => {
  // Sort participants: Active participants at the top, followed by offline participants
  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      const aOnline = a.online === true;
      const bOnline = b.online === true;

      // 1. Online participants first
      if (aOnline !== bOnline) {
        return aOnline ? -1 : 1;
      }

      // 2. Owner first within same online state
      const aRole = (a.roles || a.role || '').toUpperCase();
      const bRole = (b.roles || b.role || '').toUpperCase();
      if (aRole === 'OWNER' && bRole !== 'OWNER') return -1;
      if (bRole === 'OWNER' && aRole !== 'OWNER') return 1;

      // 3. Current user second
      const aIsSelf = String(a.userId) === String(currentUserId);
      const bIsSelf = String(b.userId) === String(currentUserId);
      if (aIsSelf !== bIsSelf) return aIsSelf ? -1 : 1;

      // 4. Alphabetical by display name
      const aName = a.displayName || a.username || '';
      const bName = b.displayName || b.username || '';
      return aName.localeCompare(bName);
    });
  }, [participants, currentUserId]);

  const activeCount = participants.filter((p) => p.online === true).length;
  const offlineCount = participants.length - activeCount;

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-gray-800/80 text-white">
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-b border-gray-800/80 px-4 bg-slate-950">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
          <FiUsers className="text-purple-400 text-sm" />
          <span>Participants</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 rounded-full border border-emerald-900/40 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {activeCount} active
          </span>
          {offlineCount > 0 && (
            <span className="rounded-full border border-gray-800 bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-gray-400">
              {offlineCount} offline
            </span>
          )}
        </div>
      </div>

      {/* Participants List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-1">
        {sortedParticipants.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-center text-gray-500">
            <FiUsers className="text-2xl mb-1.5 opacity-50" />
            <p className="text-xs">No participants found</p>
          </div>
        ) : (
          sortedParticipants.map((p, idx) => (
            <ParticipantCard
              key={p.userId || idx}
              participant={p}
              isOwner={isOwner}
              currentUserId={currentUserId}
              onKick={onKick}
              onUpdateRole={onUpdateRole}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default ParticipantPanel;
