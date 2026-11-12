import React, { useState } from 'react';
import {
  FiTerminal,
  FiTrash2,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
  FiList,
  FiMaximize2
} from 'react-icons/fi';

const STATUS_CONFIGS = {
  SUCCESS: { label: 'Success', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: FiCheckCircle },
  ERROR: { label: 'Runtime Error', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: FiAlertCircle },
  TIMEOUT: { label: 'Time Limit Exceeded', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: FiAlertCircle },
  COMPILATION_ERROR: { label: 'Compilation Error', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: FiAlertCircle },
  RUNNING: { label: 'Executing...', bg: 'bg-purple-500/10 text-purple-300 border-purple-500/20', icon: null }
};

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch (e) {
    return '';
  }
};

const RoomOutputPanel = ({
  output,
  logs = [],
  isRunning = false,
  onClear,
  onSelectLog
}) => {
  const [viewMode, setViewMode] = useState('single'); // 'single' | 'all'

  // Normalize logs list (capped at last 30 logs)
  const displayLogs = (logs && logs.length > 0)
    ? logs.slice(0, 30)
    : (output ? [output] : []);

  const activeOutput = output || (displayLogs.length > 0 ? displayLogs[0] : null);

  const getStatusKey = (item) => {
    if (!item) return null;
    if (item.status) return item.status;
    if (item.exitCode === 0) return 'SUCCESS';
    if (item.exitCode === 124) return 'TIMEOUT';
    if (item.stderr && item.stderr.includes('error:')) return 'COMPILATION_ERROR';
    return 'ERROR';
  };

  const activeStatusKey = getStatusKey(activeOutput);
  const activeStatusInfo = activeStatusKey ? (STATUS_CONFIGS[activeStatusKey] || STATUS_CONFIGS.ERROR) : null;
  const activeExecutionTime = activeOutput ? (activeOutput.durationMs ?? activeOutput.executionTimeMs) : null;

  return (
    <div className="flex flex-col h-full bg-slate-950 border-t border-gray-800/80 text-gray-200">
      {/* Panel Header */}
      <div className="flex h-10 items-center justify-between border-b border-gray-800/80 px-4 bg-slate-900/70 select-none">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-300">
          <FiTerminal className="text-purple-400 text-sm" />
          <span>TERMINAL OUTPUT</span>
          {displayLogs.length > 0 && (
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-purple-300">
              {displayLogs.length}/30 logs
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {displayLogs.length > 1 && (
            <div className="flex items-center rounded-lg border border-gray-800 bg-slate-900 p-0.5 text-[10px]">
              <button
                type="button"
                onClick={() => setViewMode('single')}
                className={`rounded px-2 py-0.5 font-medium transition ${
                  viewMode === 'single' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Current Run
              </button>
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`rounded px-2 py-0.5 font-medium transition flex items-center gap-1 ${
                  viewMode === 'all' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <FiList className="text-[11px]" />
                <span>All 30 Logs</span>
              </button>
            </div>
          )}

          {viewMode === 'single' && activeExecutionTime !== undefined && activeExecutionTime !== null && (
            <div className="flex items-center gap-1 text-[11px] text-gray-400">
              <FiClock className="text-xs" />
              <span>{activeExecutionTime} ms</span>
            </div>
          )}

          {viewMode === 'single' && activeStatusInfo && (
            <div className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${activeStatusInfo.bg}`}>
              {activeStatusInfo.icon && <activeStatusInfo.icon className="text-xs" />}
              <span>{activeStatusInfo.label}</span>
            </div>
          )}

          <button
            type="button"
            onClick={onClear}
            title="Clear output terminal"
            className="rounded p-1 text-gray-400 hover:bg-slate-800 hover:text-white transition"
          >
            <FiTrash2 className="text-xs" />
          </button>
        </div>
      </div>

      {/* Horizontal Run Selector Chips (when multiple logs exist and in single run view) */}
      {viewMode === 'single' && displayLogs.length > 1 && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-gray-800/60 bg-slate-950/60 overflow-x-auto text-xs no-scrollbar">
          <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mr-1 flex-shrink-0">
            Recent Runs:
          </span>
          {displayLogs.map((logItem, index) => {
            const isSelected = activeOutput && activeOutput.id === logItem.id;
            const logStatusKey = getStatusKey(logItem);
            const isSuccess = logStatusKey === 'SUCCESS';
            const runNum = displayLogs.length - index;

            return (
              <button
                key={logItem.id || index}
                type="button"
                onClick={() => onSelectLog && onSelectLog(logItem)}
                className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition flex-shrink-0 border ${
                  isSelected
                    ? 'border-purple-500/60 bg-purple-950/60 text-white shadow-sm'
                    : 'border-gray-800 bg-slate-900/80 text-gray-400 hover:bg-slate-850 hover:text-gray-200'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isSuccess ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                <span>Run #{runNum}</span>
                <span className={isSuccess ? 'text-emerald-400' : 'text-rose-400'}>
                  {isSuccess ? 'Success' : 'Error'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Terminal Body */}
      <div className="flex-1 p-4 font-mono text-xs overflow-y-auto leading-relaxed bg-[#0d1117] select-text space-y-4">
        {isRunning ? (
          <div className="flex items-center gap-2 text-purple-400">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-purple-400 border-t-transparent"></div>
            <span>Compiling and executing code in secure sandbox...</span>
          </div>
        ) : displayLogs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-gray-600">
            <p>Click "Run" above to compile and execute your code.</p>
          </div>
        ) : viewMode === 'all' ? (
          /* Stream of all past 30 output logs */
          <div className="space-y-4">
            {displayLogs.map((logItem, index) => {
              const logStatusKey = getStatusKey(logItem);
              const logStatusInfo = logStatusKey ? (STATUS_CONFIGS[logStatusKey] || STATUS_CONFIGS.ERROR) : null;
              const runNum = displayLogs.length - index;
              const timeStr = formatTime(logItem.executedAt);
              const duration = logItem.durationMs ?? logItem.executionTimeMs;

              return (
                <div key={logItem.id || index} className="rounded-lg border border-gray-800/80 bg-slate-900/40 p-3 space-y-2">
                  <div className="flex items-center justify-between border-b border-gray-800/60 pb-1.5 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-purple-300">Run #{runNum}</span>
                      {timeStr && <span className="text-gray-500">• {timeStr}</span>}
                      {duration !== undefined && duration !== null && (
                        <span className="text-gray-500">• {duration} ms</span>
                      )}
                    </div>
                    {logStatusInfo && (
                      <span className={`flex items-center gap-1 rounded px-1.5 py-0.2 text-[10px] font-semibold border ${logStatusInfo.bg}`}>
                        {logStatusInfo.icon && <logStatusInfo.icon className="text-[10px]" />}
                        <span>{logStatusInfo.label}</span>
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    {logItem.stdout && (
                      <pre className="text-gray-200 whitespace-pre-wrap break-words">{logItem.stdout}</pre>
                    )}
                    {logItem.stderr && (
                      <pre className="text-rose-400 whitespace-pre-wrap break-words">{logItem.stderr}</pre>
                    )}
                    {!logItem.stdout && !logItem.stderr && (
                      <p className="text-gray-500 italic">Process completed with exit code {logItem.exitCode ?? 0} (empty output).</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Single (Current) Run View */
          <div className="space-y-2">
            {activeOutput.stdout && (
              <pre className="text-gray-200 whitespace-pre-wrap break-words">
                {activeOutput.stdout}
              </pre>
            )}

            {activeOutput.stderr && (
              <pre className="text-rose-400 whitespace-pre-wrap break-words">
                {activeOutput.stderr}
              </pre>
            )}

            {!activeOutput.stdout && !activeOutput.stderr && (
              <p className="text-gray-500 italic">
                Process finished with exit code {activeOutput.exitCode ?? 0} (empty output).
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomOutputPanel;
