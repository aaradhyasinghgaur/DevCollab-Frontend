import React from 'react';
import { FiTerminal, FiTrash2, FiClock, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';

const STATUS_CONFIGS = {
  SUCCESS: { label: 'Passed', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: FiCheckCircle },
  ERROR: { label: 'Runtime Error', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: FiAlertCircle },
  TIMEOUT: { label: 'Time Limit Exceeded', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: FiAlertCircle },
  COMPILATION_ERROR: { label: 'Compilation Error', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: FiAlertCircle },
  RUNNING: { label: 'Executing...', bg: 'bg-purple-500/10 text-purple-300 border-purple-500/20', icon: null }
};

const RoomOutputPanel = ({
  output,
  isRunning = false,
  onClear
}) => {
  const getStatusKey = () => {
    if (!output) return null;
    if (output.status) return output.status;
    if (output.exitCode === 0) return 'SUCCESS';
    if (output.exitCode === 124) return 'TIMEOUT';
    if (output.stderr && output.stderr.includes('error:')) return 'COMPILATION_ERROR';
    return 'ERROR';
  };

  const statusKey = getStatusKey();
  const statusInfo = statusKey ? STATUS_CONFIGS[statusKey] || STATUS_CONFIGS.ERROR : null;
  const executionTime = output ? (output.durationMs ?? output.executionTimeMs) : null;

  return (
    <div className="flex flex-col h-full bg-slate-950 border-t border-gray-800/80 text-gray-200">
      {/* Panel Header */}
      <div className="flex h-10 items-center justify-between border-b border-gray-800/80 px-4 bg-slate-900/60">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-300">
          <FiTerminal className="text-purple-400" />
          <span>TERMINAL OUTPUT</span>
        </div>

        <div className="flex items-center gap-3">
          {executionTime !== undefined && executionTime !== null && (
            <div className="flex items-center gap-1 text-[11px] text-gray-400">
              <FiClock className="text-xs" />
              <span>{executionTime} ms</span>
            </div>
          )}

          {statusInfo && (
            <div className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${statusInfo.bg}`}>
              {statusInfo.icon && <statusInfo.icon className="text-xs" />}
              <span>{statusInfo.label}</span>
            </div>
          )}

          <button
            onClick={onClear}
            title="Clear output console"
            className="rounded p-1 text-gray-400 hover:bg-slate-800 hover:text-white transition"
          >
            <FiTrash2 className="text-xs" />
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      <div className="flex-1 p-4 font-mono text-xs overflow-y-auto leading-relaxed bg-[#0d1117] select-text">
        {isRunning ? (
          <div className="flex items-center gap-2 text-purple-400">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-purple-400 border-t-transparent"></div>
            <span>Compiling and running in sandbox container...</span>
          </div>
        ) : output ? (
          <div className="space-y-2">
            {output.stdout && (
              <pre className="text-gray-200 whitespace-pre-wrap break-words">
                {output.stdout}
              </pre>
            )}

            {output.stderr && (
              <pre className="text-rose-400 whitespace-pre-wrap break-words">
                {output.stderr}
              </pre>
            )}

            {!output.stdout && !output.stderr && (
              <p className="text-gray-500 italic">
                Process finished with exit code {output.exitCode ?? 0} (empty output).
              </p>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-600">
            <p>Click "Run" above to compile and execute your code.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomOutputPanel;
