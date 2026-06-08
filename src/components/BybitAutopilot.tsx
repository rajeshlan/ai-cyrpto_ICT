/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect } from 'react';
import { Play, Square, Settings, Terminal, ShieldAlert, Cpu, RefreshCw, Trash2, Key } from 'lucide-react';

interface BybitConfig {
  bybit_api_key: string;
  bybit_api_secret_set: boolean;
  leverage: number;
  risk_per_trade_percent: number;
  max_open_trades: number;
  max_risk_per_trade: number;
  min_signal_score: number;
  max_margin_per_trade: number;
  max_notional_per_trade: number;
  is_configured: boolean;
}

interface BotLog {
  id: string;
  timestamp: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  message: string;
}

interface BybitAutopilotProps {
  isArmed: boolean;
  onToggleArmed: (armed: boolean) => void;
  openPositionCount: number;
  selectedTicker: string;
  onExecuteAutoTrade: (setup: any) => void;
  currentRecommendation: any;
}

export default function BybitAutopilot({
  isArmed,
  onToggleArmed,
  openPositionCount,
  selectedTicker,
  onExecuteAutoTrade,
  currentRecommendation
}: BybitAutopilotProps) {
  const [config, setConfig] = useState<BybitConfig | null>(null);
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastProcessedTimestamp, setLastProcessedTimestamp] = useState<string>('');

  // Fetch Bybit Server configuration & constraints
  const fetchConfigAndLogs = async () => {
    try {
      const configRes = await fetch('/api/bybit/config');
      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig(configData);
      }
      
      const logsRes = await fetch('/api/bybit/logs');
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData.reverse()); // latest first
      }
    } catch (err) {
      console.error("Bybit Autopilot failed to retrieve server environment:", err);
    }
  };

  const clearLogs = async () => {
    try {
      const res = await fetch('/api/bybit/clear-logs', { method: 'POST' });
      if (res.ok) {
        fetchConfigAndLogs();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const forceRefresh = async () => {
    setIsRefreshing(true);
    await fetchConfigAndLogs();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  useEffect(() => {
    fetchConfigAndLogs();
    const interval = setInterval(fetchConfigAndLogs, 3500); // refresh logs and configs every 3.5s
    return () => clearInterval(interval);
  }, []);

  // AUTO-TRADE DETECTOR PROCESSOR
  useEffect(() => {
    if (!isArmed || !currentRecommendation || !config) return;

    // Checks current scorecard matches minimum score limit configured
    const score = currentRecommendation.confidenceScore;
    const meetsScore = score >= config.min_signal_score;
    const key = `${currentRecommendation.ticker}-${currentRecommendation.direction}-${currentRecommendation.timestamp}`;

    // Prevent duplicate entries for the exact same recommendation timestamp update
    if (meetsScore && lastProcessedTimestamp !== key) {
      // Check constraints
      if (openPositionCount >= config.max_open_trades) {
        // Log locally or push message that limit is reached
        return;
      }
      
      setLastProcessedTimestamp(key);
      onExecuteAutoTrade(currentRecommendation);
    }
  }, [isArmed, currentRecommendation, config, openPositionCount, lastProcessedTimestamp, onExecuteAutoTrade]);

  return (
    <div className="bg-[#0b0f19] border border-[#1b253b] rounded-lg p-5 flex flex-col justify-between h-full shadow-xl shadow-black/35 font-sans select-none">
      
      {/* 1. Header with Active Status */}
      <div>
        <div className="flex justify-between items-center border-b border-[#1b253b] pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <Cpu className={`w-5 h-5 ${isArmed ? 'text-amber-400 animate-spin' : 'text-blue-400'}`} style={{ animationDuration: isArmed ? '4s' : '0s' }} />
            <h2 className="text-sm font-semibold tracking-wide text-gray-200 uppercase">Automated Trading Desk</h2>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${isArmed ? 'bg-amber-400 animate-ping' : 'bg-gray-500'}`} />
            <span className={`font-mono text-[10px] font-bold ${isArmed ? 'text-amber-400' : 'text-gray-500'}`}>
              {isArmed ? 'ARMED & SCANNING' : 'DISARMED'}
            </span>
          </div>
        </div>

        {/* Master Control ARM Switch */}
        <div className="mb-4">
          {isArmed ? (
            <button
              onClick={() => onToggleArmed(false)}
              className="w-full flex items-center justify-center space-x-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:border-rose-500/50 py-2.5 rounded-lg text-xs font-bold uppercase transition-all tracking-wider cursor-pointer"
            >
              <Square className="w-4 h-4 fill-rose-400/25" />
              <span>DISARM BYBIT AUTOPILOT</span>
            </button>
          ) : (
            <button
              onClick={() => {
                onToggleArmed(true);
                // Trigger local alert
                if (config && !config.is_configured) {
                  // Alert user that they are in high fidelity simulation
                }
              }}
              className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-sans font-extrabold text-xs uppercase py-2.5 rounded-lg shadow-lg shadow-amber-500/10 transition-all tracking-wider cursor-pointer"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>ARM INSTITUTIONAL EXPERT (BYBIT AUTO)</span>
            </button>
          )}
        </div>

        {/* 2. Loaded .env Variables / Constraints */}
        <div className="bg-[#070a12] border border-[#1b253b] rounded-lg p-3.5 mb-4 space-y-3 font-mono text-[11px]">
          <div className="flex justify-between items-center border-b border-[#1b253b]/40 pb-2">
            <span className="text-gray-500 flex items-center">
              <Key className="w-3.5 h-3.5 mr-1 text-sky-400" />
              BYBIT API KEYS:
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${config?.is_configured ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-[#1b253b] text-gray-400'}`}>
              {config?.is_configured ? `BYBIT ACTIVE (${config.bybit_api_key})` : 'SANDBOX SIMULATED'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] pt-1">
            <div className="flex justify-between">
              <span className="text-gray-500">LEVERAGE:</span>
              <span className="text-gray-300 font-bold">{config?.leverage || 10}x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">RISK/TRADE:</span>
              <span className="text-emerald-400 font-bold">{config?.risk_per_trade_percent || 1}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">MAX OPEN POS:</span>
              <span className="text-blue-400 font-bold">{config?.max_open_trades || 1}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">MAX SETUP RISK:</span>
              <span className="text-rose-400 font-bold">{config?.max_risk_per_trade || 2.0}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">MIN SCORE:</span>
              <span className="text-amber-400 font-bold">{config?.min_signal_score || 60} pts</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">MAX NOTIONAL:</span>
              <span className="text-purple-400 font-bold">${config?.max_notional_per_trade || 20}</span>
            </div>
            <div className="flex justify-between col-span-2 border-t border-[#1b253b]/30 pt-1.5 mt-0.5">
              <span className="text-gray-500">MAX MARGIN PER TRADE:</span>
              <span className="text-emerald-400 font-bold">${config?.max_margin_per_trade || 1.0}</span>
            </div>
          </div>
        </div>

        {/* 3. Live Bot Trading Terminal Feed Logs */}
        <div className="flex flex-col h-[180px]">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider flex items-center font-mono">
              <Terminal className="w-3.5 h-3.5 mr-1 text-amber-500" /> Live Engine logs
            </span>
            <div className="flex space-x-1.5">
              <button
                onClick={forceRefresh}
                title="Force refresh transaction log feed"
                className="text-gray-500 hover:text-gray-300 transition-all cursor-pointer p-0.5 hover:bg-[#1b253b]/40 rounded"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
              </button>
              <button
                onClick={clearLogs}
                title="Clear execution feed log history"
                className="text-gray-500 hover:text-rose-450 hover:text-rose-400 transition-all cursor-pointer p-0.5 hover:bg-[#1b253b]/40 rounded"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Actual Log Console Terminal */}
          <div className="flex-1 bg-[#05070e] border border-[#1b253b]/80 rounded-md p-2.5 overflow-y-auto font-mono text-[9px] space-y-1.5 scrollbar-thin scrollbar-thumb-gray-800">
            {logs.length === 0 ? (
              <div className="text-gray-600 italic text-center py-4">Waiting for execution triggers...</div>
            ) : (
              logs.map((log) => {
                const isErr = log.type === 'ERROR';
                const isWarn = log.type === 'WARNING';
                const isSucc = log.type === 'SUCCESS';
                return (
                  <div key={log.id} className="leading-tight break-words">
                    <span className="text-gray-650 text-gray-600 mr-1">[{log.timestamp}]</span>
                    <span className={`font-bold mr-1 ${
                      isErr ? 'text-rose-400' :
                      isWarn ? 'text-amber-400' :
                      isSucc ? 'text-emerald-400 font-extrabold' : 'text-blue-400'
                    }`}>
                      {log.type}:
                    </span>
                    <span className={`${isSucc ? 'text-gray-200' : isErr ? 'text-rose-200' : 'text-gray-450 text-gray-400'}`}>
                      {log.message}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
