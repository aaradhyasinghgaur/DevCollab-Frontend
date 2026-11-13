import React, { useEffect, useRef } from 'react';
import { FiTerminal, FiTrash2 } from 'react-icons/fi';

const COMMAND_MAP = {
  JAVASCRIPT: 'node index.js',
  PYTHON: 'python script.py',
  JAVA: 'java Main.java',
  CPP: 'g++ main.cpp && ./main',
  C: 'gcc main.c && ./main'
};

const RoomOutputPanel = ({
  history = [],
  isRunning = false,
  language = 'JAVASCRIPT',
  onClear
}) => {
  const terminalEndRef = useRef(null);

  const command = COMMAND_MAP[language?.toUpperCase()] || `run ${language?.toLowerCase() || 'code'}`;

  // Automatically scroll to the bottom whenever new output arrives or running state changes
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isRunning]);

  return (
    <div className="flex flex-col h-full bg-[#181818] border-t border-[#2b2b2b] text-gray-200 select-text font-mono">
      {/* VS Code Style Terminal Header */}
      <div className="flex h-9 items-center justify-between border-b border-[#2b2b2b] px-3 bg-[#1e1e1e] select-none text-xs">
        <div className="flex items-center gap-2">
          {/* Active Terminal Tab */}
          <div className="flex items-center gap-1.5 border-b-2 border-purple-500 px-2.5 py-1.5 font-semibold text-gray-200 bg-[#181818]">
            <FiTerminal className="text-purple-400 text-xs" />
            <span className="text-[11px] tracking-wide">TERMINAL</span>
          </div>

          <span className="text-[11px] text-gray-400 bg-[#252526] px-2 py-0.5 rounded border border-[#333]">
            {language?.toLowerCase() || 'bash'}
          </span>
        </div>

        {/* Right Toolbar Actions */}
        <div className="flex items-center gap-2">
          {isRunning && (
            <div className="flex items-center gap-1.5 text-purple-400 text-[11px]">
              <div className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
              <span>Running...</span>
            </div>
          )}

          <button
            type="button"
            onClick={onClear}
            title="Clear Terminal (clears local output history)"
            className="flex items-center gap-1 rounded p-1 text-gray-400 hover:bg-[#2a2d2e] hover:text-gray-100 transition"
          >
            <FiTrash2 className="text-xs" />
          </button>
        </div>
      </div>

      {/* VS Code Terminal Screen */}
      <div className="flex-1 p-3 overflow-y-auto leading-relaxed text-[12px] bg-[#181818] space-y-3 font-mono">
        {history.length === 0 && !isRunning && (
          <div className="text-gray-400 select-none space-y-1">
            <p>DevCollab Interactive Terminal [Version 2.0]</p>
            <p className="text-gray-400">Click "Run" in the top bar to execute your code.</p>
          </div>
        )}

        {/* History of past executions in this terminal session */}
        {history.map((item, index) => {
          const isSuccess = item.exitCode === 0;
          const durationSec = item.durationMs ? (item.durationMs / 1000).toFixed(3) : '0.000';
          const cmd = item.command || command;

          return (
            <div key={item.id || index} className="space-y-1">
              {/* Command Prompt Line */}
              <div className="flex items-center gap-2 text-emerald-400 font-semibold select-none">
                <span className="text-purple-400">❯</span>
                <span className="text-gray-300">{cmd}</span>
              </div>

              {/* Stdout Output */}
              {item.stdout && (
                <pre className="text-gray-200 whitespace-pre-wrap break-words pl-3 border-l-2 border-[#2b2b2b]">
                  {item.stdout}
                </pre>
              )}

              {/* Stderr Output */}
              {item.stderr && (
                <pre className="text-rose-400 whitespace-pre-wrap break-words pl-3 border-l-2 border-rose-900/60">
                  {item.stderr}
                </pre>
              )}

              {/* Process Finished Line */}
              <div className="text-[11px] text-gray-400 pt-0.5 flex items-center gap-2">
                <span className={isSuccess ? 'text-emerald-400' : 'text-rose-400'}>
                  [Done] exited with code={item.exitCode ?? 0} ({isSuccess ? 'Success' : 'Error'}) in {durationSec}s
                </span>
              </div>
            </div>
          );
        })}

        {/* Currently Running Command */}
        {isRunning && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold select-none">
              <span className="text-purple-400">❯</span>
              <span className="text-gray-300">{command}</span>
            </div>
            <div className="flex items-center gap-2 text-purple-400 pl-3">
              <div className="h-2 w-2 animate-ping rounded-full bg-purple-400" />
              <span className="text-[11px] italic">Executing...</span>
            </div>
          </div>
        )}

        {/* Active Terminal Prompt Line with Blinking Caret */}
        {!isRunning && (
          <div className="flex items-center gap-2 text-emerald-400 font-semibold pt-1 select-none">
            <span className="text-purple-400">❯</span>
            <span className="inline-block h-4 w-2 bg-gray-300 animate-pulse" />
          </div>
        )}

        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};

export default RoomOutputPanel;
