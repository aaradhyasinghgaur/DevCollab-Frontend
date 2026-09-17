import React from 'react';
import ParticipantCard from './ParticipantCard';
import { FiUsers } from 'react-icons/fi';

const ParticipantPanel = ({ participants = [], isOwner = false, currentUserId = null, onKick }) => {
  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-gray-800/80 text-white">
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-b border-gray-800/80 px-4 bg-slate-950">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400">
          <FiUsers className="text-purple-400 text-sm" />
          <span>Participants</span>
        </div>
        <span className="rounded-full border border-gray-800 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-gray-400">
          {participants.length}
        </span>
      </div>

      {/* Participants List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-1">
        {participants.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-center text-gray-500">
            <FiUsers className="text-2xl mb-1.5 opacity-50" />
            <p className="text-xs">No active participants</p>
          </div>
        ) : (
          participants.map((p, idx) => (
            <ParticipantCard
              key={p.userId || idx}
              participant={p}
              isOwner={isOwner}
              currentUserId={currentUserId}
              onKick={onKick}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default ParticipantPanel;
