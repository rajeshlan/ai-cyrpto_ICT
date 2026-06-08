/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { RiskSettings } from '../types';
import { Shield, ShieldAlert, Sliders, AlertTriangle } from 'lucide-react';

interface RiskManagerProps {
  settings: RiskSettings;
  onSettingsChange: (settings: RiskSettings) => void;
  openCount: number;
  unrealizedPnlPercent: number;
  dailyLossPercent: number;
  consecutiveLosses: number;
}

export default function RiskManager({
  settings,
  onSettingsChange,
  openCount,
  unrealizedPnlPercent,
  dailyLossPercent,
  consecutiveLosses,
}: RiskManagerProps) {

  const handleSliderChange = (key: keyof RiskSettings, value: number) => {
    onSettingsChange({
      ...settings,
      [key]: value
    });
  };

  const isDailyLossLimitBreached = dailyLossPercent >= settings.maxDailyLossPercent;
  const isMaxOpenLimitReached = openCount >= settings.maxOpenTrades;
  const isConsecutiveLossLimitBreached = consecutiveLosses >= settings.maxConsecutiveLosses;

  return (
    <div className="bg-[#0b0f19] border border-[#1b253b] rounded-lg p-5 h-full flex flex-col justify-between shadow-xl shadow-black/35 select-none font-sans">
      
      {/* Title & Info */}
      <div>
        <div className="flex justify-between items-center border-b border-[#1b253b] pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-blue-400" />
            <h2 className="text-sm font-semibold tracking-wide text-gray-200">RISK PROTOCOL INTERCEPT</h2>
          </div>
          
          <div className="flex items-center">
            {isDailyLossLimitBreached || isMaxOpenLimitReached || isConsecutiveLossLimitBreached ? (
              <span className="flex items-center text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded font-bold font-mono">
                <ShieldAlert className="w-3.5 h-3.5 mr-1" /> BLOCKS ACTIVE
              </span>
            ) : (
              <span className="flex items-center text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold font-mono">
                ● ESCORT ACTIVE
              </span>
            )}
          </div>
        </div>

        {/* Real-time Risk HUD */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-[#070a12] border border-[#1b253b]/80 p-2 px-3 rounded-md">
            <span className="text-[9px] text-gray-500 font-mono block uppercase">Active Open Trades</span>
            <div className="flex items-baseline justify-between mt-0.5">
              <span className={`text-base font-mono font-bold ${isMaxOpenLimitReached ? 'text-amber-400' : 'text-gray-100'}`}>
                {openCount} <span className="text-gray-500 text-xs">/ {settings.maxOpenTrades}</span>
              </span>
            </div>
            {isMaxOpenLimitReached && (
              <span className="text-[8px] text-amber-400 font-mono font-semibold block leading-tight mt-1">
                ⚠️ Open threshold reached.
              </span>
            )}
          </div>

          <div className="bg-[#070a12] border border-[#1b253b]/80 p-2 px-3 rounded-md">
            <span className="text-[9px] text-gray-500 font-mono block uppercase">Today Drawdown</span>
            <div className="flex items-baseline justify-between mt-0.5">
              <span className={`text-base font-mono font-bold ${isDailyLossLimitBreached ? 'text-rose-400' : 'text-gray-100'}`}>
                {(dailyLossPercent).toFixed(2)}% <span className="text-gray-500 text-xs">/ {settings.maxDailyLossPercent}%</span>
              </span>
            </div>
            {isDailyLossLimitBreached && (
              <span className="text-[8px] text-rose-400 font-mono font-semibold block leading-tight mt-1">
                🛑 Lock active: Daily loss breached.
              </span>
            )}
          </div>
        </div>

        {/* Risk Sliders Configuration */}
        <div className="space-y-4">
          <div className="flex items-center space-x-1 mb-2">
            <Sliders className="w-3.5 h-3.5 text-gray-400" />
            <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider font-mono">Parameters Config Panel</h3>
          </div>

          {/* Slider 1: Risk per trade */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-gray-400">Risk Allocation Per Trade</span>
              <span className="text-gray-200 font-bold">{settings.riskPerTradePercent}%</span>
            </div>
            <input 
              type="range" 
              min="0.25" 
              max="5" 
              step="0.25"
              value={settings.riskPerTradePercent} 
              onChange={(e) => handleSliderChange('riskPerTradePercent', parseFloat(e.target.value))}
              className="w-full h-1 bg-[#121927] rounded-lg appearance-none cursor-pointer accent-[#3b82f6]"
            />
            <span className="text-[9px] text-gray-500 block leading-tight font-mono">
              Sets standard loss exposure for position sizing algorithms.
            </span>
          </div>

          {/* Slider 2: Max daily loss */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-gray-400">Max Daily Drawdown Threshold</span>
              <span className="text-gray-200 font-bold">{settings.maxDailyLossPercent}%</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="10" 
              step="0.5"
              value={settings.maxDailyLossPercent} 
              onChange={(e) => handleSliderChange('maxDailyLossPercent', parseFloat(e.target.value))}
              className="w-full h-1 bg-[#121927] rounded-lg appearance-none cursor-pointer accent-[#3b82f6]"
            />
            <span className="text-[9px] text-gray-500 block leading-tight font-mono">
              Locks approval mechanics if daily loss meets this limit.
            </span>
          </div>

          {/* Slider 3: Max open trades */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-gray-400">Max Concurrent Open Positions</span>
              <span className="text-gray-200 font-bold">{settings.maxOpenTrades}</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="10" 
              step="1"
              value={settings.maxOpenTrades} 
              onChange={(e) => handleSliderChange('maxOpenTrades', parseInt(e.target.value))}
              className="w-full h-1 bg-[#121927] rounded-lg appearance-none cursor-pointer accent-[#3b82f6]"
            />
            <span className="text-[9px] text-gray-500 block leading-tight font-mono">
              Limits exposure across multiple correlation fields.
            </span>
          </div>

          {/* Consecutive Losses Limit */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-gray-400">Max Consecutive Drawdown Days</span>
              <span className="text-gray-200 font-bold">{settings.maxConsecutiveLosses}</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="5" 
              step="1"
              value={settings.maxConsecutiveLosses} 
              onChange={(e) => handleSliderChange('maxConsecutiveLosses', parseInt(e.target.value))}
              className="w-full h-1 bg-[#121927] rounded-lg appearance-none cursor-pointer accent-[#3b82f6]"
            />
            <span className="text-[9px] text-gray-500 block leading-tight font-mono">
              Current consecutive losses: <strong className={consecutiveLosses > 0 ? 'text-amber-400' : 'text-emerald-400'}>{consecutiveLosses}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Safety message block */}
      <div className="mt-5 pt-3 border-t border-[#1b253b]/60">
        <div className="flex items-start space-x-2 p-2 rounded bg-blue-500/10 border border-blue-500/15 text-[10px] text-blue-300">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="leading-normal">
            <strong>System Safeguards Active</strong>: Execution recommends automatic stops matching risk per trade targets dynamically on Bybit. Manual intervention should adhere strictly inside these parameters.
          </p>
        </div>
      </div>

    </div>
  );
}
