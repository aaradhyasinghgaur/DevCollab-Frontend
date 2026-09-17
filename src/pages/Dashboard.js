import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardNavBar from '../components/DashboardNavBar';
import RoomCard from '../components/RoomCard';
import { roomApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { FiPlus, FiHash, FiX, FiFolder, FiUsers } from 'react-icons/fi';

const SUPPORTED_LANGUAGES = [
  { value: 'JAVASCRIPT', label: 'JavaScript' },
  { value: 'PYTHON', label: 'Python' },
  { value: 'JAVA', label: 'Java' },
  { value: 'CPP', label: 'C++' },
  { value: 'C', label: 'C' }
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);

  // Create Room Form
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    language: 'JAVASCRIPT'
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');

  // Join Room Form
  const [inviteCode, setInviteCode] = useState('');
  const [joinSubmitting, setJoinSubmitting] = useState(false);
  const [joinError, setJoinError] = useState('');

  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await roomApi.getAll();
      setRooms(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load rooms:', err);
      setError(err.message || 'Failed to fetch rooms. Please check backend connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    if (!searchQuery.trim()) return rooms;
    const q = searchQuery.toLowerCase();
    return rooms.filter(
      (r) =>
        (r.roomName || r.name)?.toLowerCase().includes(q) ||
        r.language?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
    );
  }, [rooms, searchQuery]);

  const myRooms = useMemo(() => {
    return filteredRooms.filter((r) => r.ownerId === user?.id);
  }, [filteredRooms, user?.id]);

  const joinedRooms = useMemo(() => {
    return filteredRooms.filter((r) => r.ownerId !== user?.id);
  }, [filteredRooms, user?.id]);

  // Handle Create Room
  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      setCreateError('Room name is required.');
      return;
    }

    try {
      setCreateSubmitting(true);
      setCreateError('');
      const newRoom = await roomApi.create({
        name: createForm.name.trim(),
        description: createForm.description.trim(),
        language: createForm.language
      });
      setCreateModalOpen(false);
      setCreateForm({ name: '', description: '', language: 'JAVASCRIPT' });
      navigate(`/room/${newRoom.roomId || newRoom.id}`);
    } catch (err) {
      console.error('Create room error:', err);
      setCreateError(err.message || 'Failed to create room.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Handle Join Room
  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      setJoinError('Invite code is required.');
      return;
    }

    try {
      setJoinSubmitting(true);
      setJoinError('');
      const joinedRoom = await roomApi.join(inviteCode.trim());
      setJoinModalOpen(false);
      setInviteCode('');
      navigate(`/room/${joinedRoom.roomId || joinedRoom.id}`);
    } catch (err) {
      console.error('Join room error:', err);
      setJoinError(err.message || 'Invalid invite code or unable to join room.');
    } finally {
      setJoinSubmitting(false);
    }
  };

  // Handle Delete Room (Owner)
  const handleDeleteRoom = async (roomToDelete) => {
    const rId = roomToDelete.roomId || roomToDelete.id;
    const rName = roomToDelete.roomName || roomToDelete.name || 'this room';
    if (window.confirm(`Are you sure you want to permanently delete "${rName}"? All data and participant access will be removed.`)) {
      try {
        await roomApi.delete(rId);
        fetchRooms();
      } catch (err) {
        console.error('Delete room error:', err);
        setError(err.message || 'Failed to delete room.');
      }
    }
  };

  const displayName = user?.displayName || user?.username || 'Developer';

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header NavBar */}
      <DashboardNavBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Hero Workspace Bar */}
      <div className="mx-auto max-w-7xl px-6 py-10 sm:px-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              My Workspace
            </h1>
            <p className="mt-1 text-base text-gray-400">
              Welcome back, <span className="font-semibold text-purple-400">{displayName}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setJoinError('');
                setJoinModalOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl border border-gray-800 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-gray-200 shadow-sm transition hover:bg-slate-800 hover:border-gray-700"
            >
              <FiHash className="text-purple-400" />
              <span>Join Room</span>
            </button>

            <button
              onClick={() => {
                setCreateError('');
                setCreateModalOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-purple-700 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-purple-950/40 transition hover:bg-purple-600"
            >
              <FiPlus className="text-lg" />
              <span>Create Room</span>
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Content Area */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent"></div>
              <p className="text-sm text-gray-400">Loading your collaborative rooms...</p>
            </div>
          </div>
        ) : (
          <div className="mt-10 space-y-12">
            {/* Section 1: My Rooms */}
            <div>
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-950/60 border border-purple-800/40 text-xs font-bold text-purple-400">
                  {'</>'}
                </div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">
                  My Rooms
                </h2>
                <span className="rounded-full border border-gray-800 bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-gray-300">
                  {myRooms.length}
                </span>
              </div>

              {myRooms.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {myRooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      currentUserId={user?.id}
                      onDelete={handleDeleteRoom}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-800/80 bg-slate-900/30 p-10 text-center">
                  <FiFolder className="text-4xl text-gray-600 mb-3" />
                  <p className="text-sm font-medium text-gray-300">No rooms created yet</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm">
                    Start your first collaborative coding session by clicking "+ Create Room".
                  </p>
                </div>
              )}
            </div>

            {/* Section 2: Joined Rooms */}
            <div>
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-950/60 border border-blue-800/40 text-xs font-bold text-blue-400">
                  <FiUsers />
                </div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">
                  Joined Rooms
                </h2>
                <span className="rounded-full border border-gray-800 bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-gray-300">
                  {joinedRooms.length}
                </span>
              </div>

              {joinedRooms.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {joinedRooms.map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      currentUserId={user?.id}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-800/80 bg-slate-900/30 p-10 text-center">
                  <FiUsers className="text-4xl text-gray-600 mb-3" />
                  <p className="text-sm font-medium text-gray-300">No joined rooms</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm">
                    Join a teammate's coding room using their invite code with "# Join Room".
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CREATE ROOM MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-gray-800 bg-slate-900 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <h3 className="text-lg font-bold text-white">Create New Coding Room</h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-slate-800 hover:text-white"
              >
                <FiX className="text-lg" />
              </button>
            </div>

            {createError && (
              <div className="mt-4 rounded-lg border border-red-500/40 bg-red-950/40 p-3 text-xs text-red-300">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateRoom} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Room Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Systems Lab"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-800 bg-slate-950 p-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Primary Language
                </label>
                <select
                  value={createForm.language}
                  onChange={(e) => setCreateForm({ ...createForm, language: e.target.value })}
                  className="w-full rounded-lg border border-gray-800 bg-slate-950 p-2.5 text-sm text-white outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Short summary of what this room is for..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full rounded-lg border border-gray-800 bg-slate-950 p-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-lg border border-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="rounded-lg bg-purple-700 px-5 py-2 text-xs font-semibold text-white shadow hover:bg-purple-600 disabled:opacity-50"
                >
                  {createSubmitting ? 'Creating...' : 'Create Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JOIN ROOM MODAL */}
      {joinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-slate-900 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <h3 className="text-lg font-bold text-white">Join Room via Invite Code</h3>
              <button
                onClick={() => setJoinModalOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-slate-800 hover:text-white"
              >
                <FiX className="text-lg" />
              </button>
            </div>

            {joinError && (
              <div className="mt-4 rounded-lg border border-red-500/40 bg-red-950/40 p-3 text-xs text-red-300">
                {joinError}
              </div>
            )}

            <form onSubmit={handleJoinRoom} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Invite Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ROOM-78K2P9"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  className="w-full rounded-lg border border-gray-800 bg-slate-950 p-2.5 font-mono text-sm tracking-wider text-white placeholder-gray-500 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setJoinModalOpen(false)}
                  className="rounded-lg border border-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joinSubmitting}
                  className="rounded-lg bg-purple-700 px-5 py-2 text-xs font-semibold text-white shadow hover:bg-purple-600 disabled:opacity-50"
                >
                  {joinSubmitting ? 'Joining...' : 'Join Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
