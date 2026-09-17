import React from 'react';
import { FiMessageSquare, FiUsers, FiTerminal } from 'react-icons/fi';

const RoomSideBar = ({
  activeTab,
  onTabChange,
  unreadCount = 0,
  participantCount = 0,
  connected = false
}) => {
  const tabs = [
    {
      id: 'chat',
      icon: FiMessageSquare,
      title: 'Room Chat',
      badge: unreadCount > 0 ? unreadCount : null
    },
    {
      id: 'participants',
      icon: FiUsers,
      title: 'Participants',
      badge: participantCount > 0 ? participantCount : null
    },
    {
      id: 'output',
      icon: FiTerminal,
      title: 'Terminal Output',
      badge: null
    }
  ];

  return (
    <aside className="flex w-14 flex-col items-center justify-between border-r border-gray-800/80 bg-slate-950 py-3">
      {/* Top action icons */}
      <div className="flex flex-col items-center gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(isActive ? null : tab.id)}
              title={tab.title}
              className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition ${
                isActive
                  ? 'bg-purple-700 text-white shadow-lg shadow-purple-950/50'
                  : 'text-gray-400 hover:bg-slate-900 hover:text-gray-200'
              }`}
            >
              <Icon className="text-lg" />
              {tab.badge && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-purple-500 px-1 text-[9px] font-bold text-white">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom indicator */}
      <div className="flex flex-col items-center">
        <div
          className={`h-2 w-2 rounded-full ${
            connected ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-amber-400/80 animate-pulse'
          }`}
          title={connected ? 'Connected to DevCollab WebSocket' : 'Connecting to WebSocket...'}
        ></div>
      </div>
    </aside>
  );
};

export default RoomSideBar;
