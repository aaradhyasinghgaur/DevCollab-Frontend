import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import RoomNavbar from '../components/RoomNavbar';
import RoomSideBar from '../components/RoomSideBar';
import EditorNavBar from '../components/EditorNavBar';
import RoomEditor from '../components/RoomEditor';
import ChatPanel from '../components/ChatPanel';
import ParticipantPanel from '../components/ParticipantPanel';
import RoomOutputPanel from '../components/RoomOutputPanel';
import RoomSocketManager from '../websocket/socket';
import { roomApi, executionApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

const RoomPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Editor configuration
  const [language, setLanguage] = useState('JAVASCRIPT');
  const [fontSize, setFontSize] = useState(14);

  // Code Execution
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState(null);
  const [outputLogs, setOutputLogs] = useState([]);

  // Sidebar & Layout State
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'participants' | 'output' | null
  const [showOutputBottom, setShowOutputBottom] = useState(true);

  // Socket Manager state & reference
  const [socketManager, setSocketManager] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Ref to extract latest code from RoomEditor
  const getCodeRef = useRef(null);

  // Load Room Details
  const fetchRoomDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await roomApi.getById(roomId);
      const normalizedRoom = data ? {
        ...data,
        id: data.roomId || data.id,
        roomId: data.roomId || data.id,
        name: data.roomName || data.name,
        roomName: data.roomName || data.name
      } : null;
      setRoom(normalizedRoom);
      const initialParticipants = (data?.participants || []).map((p) => {
        if (user && String(p.userId) === String(user.id)) {
          return { ...p, online: true };
        }
        return p;
      });
      setParticipants(initialParticipants);
      if (data && data.language) {
        setLanguage(data.language);
      }
    } catch (err) {
      console.error('Failed to load room details:', err);
      setError(err.message || 'Room not found or you do not have permission to access it.');
    } finally {
      setLoading(false);
    }
  }, [roomId, user]);

  // Helper to normalize execution response
  const normalizeExecution = useCallback((result) => {
    if (!result) return null;
    let status = result.status;
    if (!status) {
      if (result.exitCode === 0) status = 'SUCCESS';
      else if (result.exitCode === 124) status = 'TIMEOUT';
      else if (result.stderr && result.stderr.includes('error:')) status = 'COMPILATION_ERROR';
      else status = 'ERROR';
    }
    return {
      ...result,
      id: result.id || 'log-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now(),
      status,
      durationMs: result.durationMs ?? result.executionTimeMs ?? 0,
      executedAt: result.executedAt || new Date().toISOString()
    };
  }, []);

  // Load historical execution runs for this room (up to 30)
  const loadExecutions = useCallback(async () => {
    try {
      const data = await executionApi.getExecutions(roomId);
      if (Array.isArray(data) && data.length > 0) {
        const normalized = data.slice(0, 30).map(normalizeExecution);
        setOutputLogs(normalized);
        setOutput(normalized[0]);
      }
    } catch (e) {
      console.warn('Could not load past executions:', e);
    }
  }, [roomId, normalizeExecution]);

  useEffect(() => {
    fetchRoomDetails();
    loadExecutions();
  }, [fetchRoomDetails, loadExecutions]);

  // Initialize WebSocket Connection
  useEffect(() => {
    if (!roomId) return;

    const manager = new RoomSocketManager(
      roomId,
      () => {
        setSocketConnected(true);
      },
      userRef.current,
      () => {
        setSocketConnected(false);
      }
    );

    setSocketManager(manager);
    manager.connect();

    // Subscribe to execution events broadcast to the room
    const unsubExecution = manager.subscribe('execution', (execResult) => {
      const normalized = normalizeExecution(execResult);
      setOutputLogs((prev) => [normalized, ...prev.filter((l) => l.id !== normalized.id)].slice(0, 30));
      setOutput(normalized);
      setIsRunning(false);
      setShowOutputBottom(true);
    });

    // Subscribe to presence events (active, offline, leave, room_deleted, kicked)
    const unsubPresence = manager.subscribe('presence', (presenceMsg) => {
      if (!presenceMsg) return;

      const currentUserId = userRef.current?.id;

      if (presenceMsg.type === 'KICKED' || presenceMsg.status === 'KICKED') {
        if (currentUserId && String(presenceMsg.userId) === String(currentUserId)) {
          alert(presenceMsg.message || 'You have been removed from this room by the owner.');
          navigate('/dashboard');
          return;
        }
        if (Array.isArray(presenceMsg.participants)) {
          setParticipants(presenceMsg.participants);
        } else {
          setParticipants((prev) => prev.filter((p) => String(p.userId) !== String(presenceMsg.userId)));
        }
        return;
      }

      if (presenceMsg.type === 'ROOM_DELETED' || presenceMsg.status === 'ROOM_DELETED') {
        alert(presenceMsg.message || 'This room has been deleted by the owner.');
        navigate('/dashboard');
        return;
      }

      if (presenceMsg.type === 'ROLE_UPDATED' || presenceMsg.status === 'ROLE_UPDATED') {
        if (Array.isArray(presenceMsg.participants) && presenceMsg.participants.length > 0) {
          const mapped = presenceMsg.participants.map((p) => {
            if (currentUserId && String(p.userId) === String(currentUserId)) {
              return { ...p, online: true };
            }
            return { ...p, online: p.online === true || p.online === 'true' };
          });
          setParticipants(mapped);
        } else if (presenceMsg.userId && (presenceMsg.role || presenceMsg.roles)) {
          const newR = presenceMsg.role || presenceMsg.roles;
          setParticipants((prev) =>
            prev.map((p) =>
              String(p.userId) === String(presenceMsg.userId)
                ? { ...p, roles: newR, role: newR }
                : p
            )
          );
        }
        return;
      }

      const isLeave = presenceMsg.type === 'LEAVE' ||
                      presenceMsg.status === 'LEAVE' ||
                      presenceMsg.type === 'OFFLINE' ||
                      presenceMsg.status === 'OFFLINE';

      // 1. If backend gave a full updated participants list, use it
      if (Array.isArray(presenceMsg.participants) && presenceMsg.participants.length > 0) {
        const mapped = presenceMsg.participants.map((p) => {
          if (currentUserId && String(p.userId) === String(currentUserId)) {
            return { ...p, online: true };
          }
          return { ...p, online: p.online === true || p.online === 'true' };
        });
        setParticipants(mapped);
        return;
      }

      // 2. Direct atomic presence update for the specific user
      if (presenceMsg.userId) {
        setParticipants((prev) => {
          const exists = prev.some((p) => String(p.userId) === String(presenceMsg.userId));
          if (!exists && !isLeave) {
            const newParticipant = {
              userId: presenceMsg.userId,
              displayName: presenceMsg.displayName || presenceMsg.username || 'Collaborator',
              online: true,
              role: 'EDITOR'
            };
            return [...prev, newParticipant];
          }

          return prev.map((p) => {
            if (String(p.userId) === String(presenceMsg.userId)) {
              return { ...p, online: !isLeave };
            }
            if (currentUserId && String(p.userId) === String(currentUserId)) {
              return { ...p, online: true };
            }
            return p;
          });
        });
      }
    });

    // Send periodic presence heartbeat every 15 seconds
    const heartbeatInterval = setInterval(() => {
      if (manager && (manager.connected || manager.client?.connected)) {
        const currentUser = userRef.current;
        manager.sendPresence('ACTIVE', {
          username: currentUser?.username || currentUser?.email,
          userId: currentUser?.id,
          displayName: currentUser?.displayName || currentUser?.username
        });
      }
    }, 15000);

    const handleBeforeUnload = () => {
      if (manager) {
        manager.leave();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearInterval(heartbeatInterval);
      if (unsubExecution) unsubExecution();
      if (unsubPresence) unsubPresence();
      manager.leave();
      setSocketManager(null);
      setSocketConnected(false);
    };
  }, [roomId, navigate]);

  // Keep socketManager updated with latest authenticated user without reconnecting
  useEffect(() => {
    if (socketManager && user) {
      socketManager.setUserInfo(user);
      socketManager.sendPresence('ACTIVE', {
        username: user.username || user.email,
        userId: user.id,
        displayName: user.displayName || user.username
      });
    }
  }, [socketManager, user]);

  // Handle Code Execution
  const handleRunCode = async () => {
    if (!getCodeRef.current) return;
    const code = getCodeRef.current();

    try {
      setIsRunning(true);
      setShowOutputBottom(true);

      const result = await executionApi.execute(roomId, {
        code,
        language,
        stdin: ''
      });

      const normalized = normalizeExecution(result);
      setOutputLogs((prev) => [normalized, ...prev.filter((l) => l.id !== normalized.id)].slice(0, 30));
      setOutput(normalized);
    } catch (err) {
      console.error('Code execution failed:', err);
      const errorLog = normalizeExecution({
        status: 'ERROR',
        stderr: err.message || 'Execution failed. Check backend runner configuration.',
        exitCode: 1,
        durationMs: 0
      });
      setOutputLogs((prev) => [errorLog, ...prev].slice(0, 30));
      setOutput(errorLog);
    } finally {
      setIsRunning(false);
    }
  };

  // Handle Language Change
  const handleLanguageChange = async (newLang) => {
    setLanguage(newLang);
    // Optionally update room language on backend if owner
    const isRoomOwner = Boolean(user?.id && room?.ownerId && String(user.id) === String(room.ownerId));
    if (room && isRoomOwner) {
      try {
        await roomApi.update(roomId, {
          name: room.name || room.roomName,
          language: newLang
        });
        setRoom((prev) => ({ ...prev, language: newLang }));
      } catch (e) {
        console.warn('Failed to update room language on backend:', e);
      }
    }
  };

  // Owner kicks a participant
  const isOwner = Boolean(user?.id && room?.ownerId && String(user.id) === String(room.ownerId));

  const handleKickParticipant = async (targetUserId, targetName) => {
    if (!window.confirm(`Are you sure you want to kick ${targetName || 'this participant'} from the room? They will lose access to this room.`)) {
      return;
    }
    try {
      await roomApi.kickParticipant(roomId, targetUserId);
      setParticipants((prev) => prev.filter((p) => String(p.userId) !== String(targetUserId)));
    } catch (err) {
      console.error('Failed to kick participant:', err);
      alert(err.message || 'Failed to kick participant');
    }
  };

  // Owner updates a participant's access right (role)
  const handleUpdateRole = async (targetUserId, newRole) => {
    try {
      setParticipants((prev) =>
        prev.map((p) =>
          String(p.userId) === String(targetUserId)
            ? { ...p, roles: newRole, role: newRole }
            : p
        )
      );
      await roomApi.updateParticipantRole(roomId, targetUserId, newRole);
    } catch (err) {
      console.error('Failed to update participant role:', err);
      alert(err.message || 'Failed to update access right');
      fetchRoomDetails();
    }
  };

  const currentParticipant = participants.find((p) => String(p.userId) === String(user?.id));
  const currentUserRole = isOwner ? 'OWNER' : (currentParticipant?.roles || currentParticipant?.role || 'EDITOR');
  const isReadOnly = String(currentUserRole).toUpperCase() === 'VIEWER';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-500 border-t-transparent"></div>
          <p className="text-sm text-gray-400">Loading collaborative room...</p>
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-slate-900 p-8 text-center shadow-xl">
          <h2 className="text-xl font-bold text-rose-400">Unable to Open Room</h2>
          <p className="mt-2 text-sm text-gray-400">{error || 'Room does not exist.'}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-6 rounded-lg bg-purple-700 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-purple-600"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-white select-none">
      {/* Top Navigation Bar */}
      <RoomNavbar room={room} socketManager={socketManager} />

      {/* Main Workspace Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Activity Sidebar Bar */}
        <RoomSideBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          participantCount={participants.length || 1}
          connected={socketConnected}
        />

        {/* Expandable Side Panel (Chat / Participants) */}
        <div className={`w-80 flex-shrink-0 h-full ${activeTab === 'chat' ? 'block' : 'hidden'}`}>
          <ChatPanel
            roomId={roomId}
            socketManager={socketManager}
          />
        </div>

        <div className={`w-72 flex-shrink-0 h-full ${activeTab === 'participants' ? 'block' : 'hidden'}`}>
          <ParticipantPanel
            participants={participants}
            isOwner={isOwner}
            currentUserId={user?.id}
            onKick={handleKickParticipant}
            onUpdateRole={handleUpdateRole}
          />
        </div>

        {/* Center Coding Canvas */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Editor Header Toolbar */}
          <EditorNavBar
            fontSize={fontSize}
            setFontSize={setFontSize}
            language={language}
            onLanguageChange={handleLanguageChange}
            onRun={handleRunCode}
            isRunning={isRunning}
            inviteCode={room.inviteCode}
          />

          {/* Editor & Terminal Split */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Monaco Editor Canvas */}
            <div className={`w-full ${showOutputBottom ? 'h-[65%]' : 'h-full'} transition-all duration-150`}>
              <RoomEditor
                roomId={roomId}
                language={language}
                fontSize={fontSize}
                readOnly={isReadOnly}
                participants={participants}
                initialContent={room.content}
                initialRevision={room.revision}
                socketManager={socketManager}
                onCodeChangeRef={getCodeRef}
              />
            </div>

            {/* Bottom Output Terminal Panel */}
            {showOutputBottom && (
              <div className="h-[35%] w-full">
                <RoomOutputPanel
                  output={output}
                  logs={outputLogs}
                  isRunning={isRunning}
                  onSelectLog={(log) => setOutput(log)}
                  onClear={() => {
                    setOutput(null);
                    setOutputLogs([]);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomPage;
