import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from './Logo';
import { TbDoorExit } from 'react-icons/tb';
import { FiCopy, FiCheck, FiArrowLeft, FiTrash2 } from 'react-icons/fi';
import { roomApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

const LANGUAGE_STYLES = {
  JAVASCRIPT: { label: 'JavaScript', dot: 'bg-yellow-400', text: 'text-yellow-400' },
  PYTHON: { label: 'Python', dot: 'bg-emerald-400', text: 'text-emerald-400' },
  JAVA: { label: 'Java', dot: 'bg-amber-500', text: 'text-amber-400' },
  CPP: { label: 'C++', dot: 'bg-blue-400', text: 'text-blue-400' },
  C: { label: 'C', dot: 'bg-cyan-400', text: 'text-cyan-400' }
};

const RoomNavbar = ({ room, socketManager }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const isOwner = Boolean(user?.id && room?.ownerId && String(user.id) === String(room.ownerId));

  const langStyle = (room && LANGUAGE_STYLES[room.language]) || {
    label: room?.language || 'JavaScript',
    dot: 'bg-yellow-400',
    text: 'text-yellow-400'
  };

  const handleCopyCode = () => {
    if (room?.inviteCode) {
      navigator.clipboard.writeText(room.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDeleteRoom = async () => {
    const targetRoomId = room?.roomId || room?.id;
    if (!targetRoomId) return;
    const targetRoomName = room?.roomName || room?.name || 'this room';
    if (window.confirm(`Are you sure you want to delete "${targetRoomName}"? This action cannot be undone and all participants will be disconnected.`)) {
      try {
        setLeaving(true);
        if (socketManager) {
          socketManager.leave(user);
        }
        await roomApi.delete(targetRoomId);
      } catch (e) {
        console.warn('Delete room error:', e);
      } finally {
        navigate('/dashboard');
      }
    }
  };

  const handleLeaveRoom = async () => {
    const targetRoomId = room?.roomId || room?.id;
    if (!targetRoomId) return;
    if (window.confirm('Are you sure you want to leave this room? You can return from your dashboard at any time.')) {
      try {
        setLeaving(true);
        if (socketManager) {
          socketManager.leave(user);
        }
        await roomApi.leave(targetRoomId);
      } catch (e) {
        console.warn('Leave room error (proceeding to dashboard):', e);
      } finally {
        navigate('/dashboard');
      }
    }
  };

  const handleDeleteRoomForSelf = async () => {
    const targetRoomId = room?.roomId || room?.id;
    const targetRoomName = room?.roomName || room?.name || 'this room';
    if (!targetRoomId) return;

    if (window.confirm(`Are you sure you want to delete "${targetRoomName}" for yourself? It will be removed from your workspace, but other members will not be affected.`)) {
      try {
        setLeaving(true);
        if (socketManager) {
          socketManager.leave(user);
        }
        await roomApi.delete(targetRoomId);
      } catch (e) {
        console.warn('Delete room for self error (proceeding to dashboard):', e);
      } finally {
        navigate('/dashboard');
      }
    }
  };

  return (
    <nav className="flex h-16 items-center justify-between border-b border-gray-800/80 bg-slate-950 px-4 sm:px-6">
      {/* Left: Back / Logo / Room Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => {
            if (socketManager) {
              socketManager.leave(user);
            }
            navigate('/dashboard');
          }}
          title="Back to Workspace Dashboard"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-800 bg-slate-900 text-gray-400 transition hover:bg-slate-800 hover:text-white"
        >
          <FiArrowLeft className="text-base" />
        </button>

        <Logo />

        <div className="hidden h-6 w-px bg-gray-800 sm:block"></div>

        <div className="flex items-center gap-2">
          <h1 className="text-base font-bold text-gray-100 max-w-xs sm:max-w-md truncate">
            {room?.roomName || room?.name || 'Collaborative Coding Room'}
          </h1>
        </div>
      </div>

      {/* Right: Language, Invite Code, Leave Button */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Language Badge */}
        <div className="hidden items-center gap-2 rounded-full border border-gray-800 bg-slate-900 px-3 py-1 text-xs font-semibold sm:flex">
          <div className={`h-2 w-2 rounded-full ${langStyle.dot}`}></div>
          <span className={langStyle.text}>{langStyle.label}</span>
        </div>

        {/* Copy Invite Code */}
        {room?.inviteCode && (
          <button
            onClick={handleCopyCode}
            title="Copy Invite Code to share with peers"
            className="flex items-center gap-1.5 rounded-lg border border-gray-800 bg-slate-900 px-2.5 py-1.5 text-xs font-mono text-gray-300 hover:bg-slate-800 hover:border-gray-700 transition"
          >
            {copied ? (
              <>
                <FiCheck className="text-emerald-400" />
                <span className="text-emerald-400 font-sans">Copied!</span>
              </>
            ) : (
              <>
                <FiCopy className="text-gray-400" />
                <span>{room.inviteCode}</span>
              </>
            )}
          </button>
        )}

        {/* Action Button: Delete Room for Owner, Leave / Delete for Collaborators */}
        {isOwner ? (
          <button
            onClick={handleDeleteRoom}
            disabled={leaving}
            title="Delete this room permanently"
            className="flex items-center gap-1.5 rounded-lg border border-rose-900/70 bg-rose-950/60 px-3 py-1.5 text-xs font-semibold text-rose-400 transition hover:bg-rose-900/80 hover:text-rose-200 hover:border-rose-700 disabled:opacity-50"
          >
            <FiTrash2 className="text-sm" />
            <span className="hidden sm:inline">{leaving ? 'Deleting...' : 'Delete room'}</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleLeaveRoom}
              disabled={leaving}
              title="Leave room session (keep on dashboard)"
              className="flex items-center gap-1.5 rounded-lg border border-gray-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
            >
              <TbDoorExit className="text-base" />
              <span className="hidden sm:inline">{leaving ? 'Leaving...' : 'Leave session'}</span>
            </button>
            <button
              onClick={handleDeleteRoomForSelf}
              disabled={leaving}
              title="Delete this room for yourself"
              className="flex items-center gap-1.5 rounded-lg border border-rose-900/70 bg-rose-950/60 px-3 py-1.5 text-xs font-semibold text-rose-400 transition hover:bg-rose-900/80 hover:text-rose-200 hover:border-rose-700 disabled:opacity-50"
            >
              <FiTrash2 className="text-sm" />
              <span className="hidden sm:inline">{leaving ? 'Deleting...' : 'Delete room'}</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default RoomNavbar;
