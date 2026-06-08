/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  AssetTicker, 
  MarketState, 
  TradeRecommendation, 
  TradeJournalEntry, 
  RiskSettings, 
  Alert 
} from './types';
import { wsService } from './services/websocketSim';
import Watchlist from './components/Watchlist';
import ChartTerminal from './components/ChartTerminal';
import SetupValidator from './components/SetupValidator';
import RiskManager from './components/RiskManager';
import Journal from './components/Journal';
import CopilotChat from './components/CopilotChat';
import BybitAutopilot from './components/BybitAutopilot';
import { ShieldCheck, Flame, BellRing, BrainCircuit, Play, Square, Settings2 } from 'lucide-react';

export default function App() {
  const [selectedTicker, setSelectedTicker] = useState<AssetTicker>('BTCUSDT');
  const [isAutopilotArmed, setIsAutopilotArmed] = useState<boolean>(false);
  const [marketStates, setMarketStates] = useState<Record<AssetTicker, MarketState | null>>({
    BTCUSDT: null,
    ETHUSDT: null,
    SOLUSDT: null,
  });

  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [journalEntries, setJournalEntries] = useState<TradeJournalEntry[]>([
    {
      id: 'mock-1',
      ticker: 'BTCUSDT',
      direction: 'LONG',
      entryPrice: 68120.00,
      exitPrice: 69245.50,
      quantity: 0.1,
      pnl: 112.55,
      pnlPercent: 1.65,
      riskAmount: 100,
      status: 'WIN',
      openTime: '10:15:30',
      closeTime: '11:45:10',
      notes: 'Standard MSS Shift buy on discounted OTE level.',
    },
    {
      id: 'mock-2',
      ticker: 'ETHUSDT',
      direction: 'SHORT',
      entryPrice: 3642.10,
      exitPrice: 3698.80,
      quantity: 1.0,
      pnl: -56.70,
      pnlPercent: -1.56,
      riskAmount: 100,
      status: 'LOSS',
      openTime: '09:02:15',
      closeTime: '09:35:45',
      notes: 'Premium pool mitigation did not hold. Stopped out.',
    },
    {
      id: 'mock-3',
      ticker: 'SOLUSDT',
      direction: 'LONG',
      entryPrice: 145.20,
      exitPrice: 151.35,
      quantity: 10.0,
      pnl: 61.50,
      pnlPercent: 4.23,
      riskAmount: 50,
      status: 'WIN',
      openTime: '08:12:00',
      closeTime: '12:05:00',
      notes: 'BOS expansion ride. Fully liquidated at BSL target.',
    }
  ]);

  const [riskSettings, setRiskSettings] = useState<RiskSettings>({
    riskPerTradePercent: 1.0,
    maxDailyLossPercent: 3.0,
    maxOpenTrades: 3,
    maxExposurePercent: 5.0,
    maxConsecutiveLosses: 3,
  });

  // Derived metrics from journal
  const stats = React.useMemo(() => {
    const historical = journalEntries.filter(e => e.status !== 'OPEN');
    const losses = historical.filter(e => e.status === 'LOSS');
    const dailyLossVal = losses.reduce((sum, e) => sum + Math.abs(e.pnlPercent), 0);
    const consecutiveCount = 0; // simplified simulation
    return {
      openCount: journalEntries.filter(e => e.status === 'OPEN').length,
      unrealizedPnlPercent: 0,
      dailyLossPercent: dailyLossVal,
      consecutiveLosses: losses.length > 0 ? Math.min(riskSettings.maxConsecutiveLosses, losses.length) : 0,
    };
  }, [journalEntries, riskSettings.maxConsecutiveLosses]);

  // Hook up alert emitter from WS simulation
  useEffect(() => {
    const unsubAlerts = wsService.subscribeToAlerts((alert) => {
      setActiveAlerts((prev) => {
        const next = [alert, ...prev];
        return next.slice(0, 5); // Keep last 5 alerts
      });
      // Auto dismiss alert after 5 seconds
      setTimeout(() => {
        setActiveAlerts((prev) => prev.filter((a) => a.id !== alert.id));
      }, 5500);
    });

    return () => unsubAlerts();
  }, []);

  // Update focused market ticker details callback
  const handleMarketStateUpdate = useCallback((ticker: AssetTicker, state: MarketState) => {
    setMarketStates((prev) => ({
      ...prev,
      [ticker]: state,
    }));
  }, []);

  // Tickers current price lookups helper
  const currentPrices = React.useMemo(() => {
    return {
      BTCUSDT: marketStates.BTCUSDT?.price || 0,
      ETHUSDT: marketStates.ETHUSDT?.price || 0,
      SOLUSDT: marketStates.SOLUSDT?.price || 0,
    };
  }, [marketStates]);

  // Get active selected setup recommendation
  const currentRecommendation = React.useMemo(() => {
    const state = marketStates[selectedTicker];
    if (!state) return null;
    return wsService.getSetupRecommendation(selectedTicker);
  }, [selectedTicker, marketStates]);

  // Dispatch Trade manual Action Click
  const handleApproveTrade = (tradeData: Omit<TradeJournalEntry, 'id' | 'openTime' | 'closeTime' | 'status'>) => {
    // Check boundaries
    if (stats.openCount >= riskSettings.maxOpenTrades) {
      alert("Risk block active: Maximum concurrent open trades limit met!");
      return;
    }
    if (stats.dailyLossPercent >= riskSettings.maxDailyLossPercent) {
      alert("Risk block active: Maximum daily drawdown barrier reached. Execution suspended.");
      return;
    }

    const newOpenPosition: TradeJournalEntry = {
      ...tradeData,
      id: `trade-${Date.now()}`,
      openTime: new Date().toLocaleTimeString(),
      closeTime: '',
      status: 'OPEN',
    };

    setJournalEntries((prev) => [newOpenPosition, ...prev]);
  };

  // Dispatch Trade Autopilot Action
  const handleExecuteAutoTrade = useCallback(async (setup: any) => {
    try {
      const res = await fetch('/api/bybit/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: setup.ticker,
          direction: setup.direction,
          price: (setup.entryZone.start + setup.entryZone.end) / 2,
          stopLoss: setup.stopLoss,
          takeProfit: setup.tp1,
          score: setup.confidenceScore
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          // Successfully placed trade (either simulated or real). Update our live position list!
          const newPos: TradeJournalEntry = {
            id: data.orderId || `trade-${Date.now()}`,
            ticker: setup.ticker,
            direction: setup.direction,
            entryPrice: (setup.entryZone.start + setup.entryZone.end) / 2,
            exitPrice: 0,
            quantity: data.quantity,
            pnl: 0,
            pnlPercent: 0,
            riskAmount: data.riskSpent,
            setupType: `BYBIT AUTO: ${setup.grade} GRADE`,
            status: 'OPEN',
            openTime: data.timestamp || new Date().toLocaleTimeString(),
            closeTime: '',
            notes: `Auto order ${data.orderId}. Hash: ${data.txnHash}. Margin: $${data.finalMargin.toFixed(2)}. Connection: ${data.executionMode}`
          };

          setJournalEntries((prev) => [newPos, ...prev]);

          // Trigger alerting
          const isReal = data.executionMode === "REAL_BYBIT";
          const botAlert: Alert = {
            id: `alert-auto-${Date.now()}`,
            ticker: setup.ticker,
            type: 'TRADE_COMPLETED',
            message: isReal 
              ? `🛡️ [BYBIT LIVE] Auto-order confirmed! Margin: $${data.finalMargin.toFixed(2)}. Active position created.`
              : `🚀 [SANDBOX] Auto position of ${data.quantity} filled on simulated liquidity pool!`,
            timestamp: new Date().toLocaleTimeString(),
            severity: isReal ? 'high' : 'medium'
          };
          setActiveAlerts((prev) => [botAlert, ...prev.slice(0, 4)]);
          
          setTimeout(() => {
            setActiveAlerts((prev) => prev.filter((a) => a.id !== botAlert.id));
          }, 5500);
        }
      }
    } catch (err) {
      console.error("Auto trigger dispatch error:", err);
    }
  }, []);

  // Dispatch Close Position Action Click
  const handleClosePosition = (id: string, exitPrice: number) => {
    setJournalEntries((prev) => 
      prev.map((pos) => {
        if (pos.id !== id) return pos;

        // Calculate final PnL math
        const priceDiff = exitPrice - pos.entryPrice;
        const isLong = pos.direction === 'LONG';
        const directionFactor = isLong ? 1 : -1;
        
        const pnlPercent = (priceDiff / pos.entryPrice) * 100 * directionFactor;
        const pnlAmt = pos.quantity * pos.entryPrice * (pnlPercent / 100);

        const status = pnlAmt >= 0 ? 'WIN' : 'LOSS';

        return {
          ...pos,
          exitPrice,
          pnl: pnlAmt,
          pnlPercent,
          status,
          closeTime: new Date().toLocaleTimeString(),
        };
      })
    );
  };

  return (
    <div className="min-h-screen bg-[#070913] text-gray-200 font-sans antialiased flex flex-col justify-between selection:bg-blue-500/30 selection:text-white">
      
      {/* 1. Header Control Panel */}
      <header className="bg-[#0b0f19] border-b border-[#1b253b] sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
          
          {/* Logo & Slogan */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 via-blue-500 to-emerald-400 flex items-center justify-center shadow-md shadow-blue-500/10">
              <Flame className="w-5.5 h-4.5 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-white font-sans flex items-center leading-none">
                TradeBrain
                <span className="text-[#3b82f6] ml-1 font-bold">ICT</span>
              </h1>
              <span className="text-[10px] text-gray-500 font-mono tracking-wider">
                COGNITIVE DECISION COCKPID SYSTEM • v1.1.0-alpha
              </span>
            </div>
          </div>

          {/* Core HUD status metrics */}
          <div className="flex items-center space-x-5 text-xs font-mono">
            
            <div className="hidden md:flex flex-col items-end">
              <span className="text-gray-500 text-[10px]">COCKPIT DRAWDOWN STATUS</span>
              <span className={`font-bold ${stats.dailyLossPercent >= riskSettings.maxDailyLossPercent ? 'text-rose-400' : 'text-emerald-400'}`}>
                {stats.dailyLossPercent.toFixed(2)}% / {riskSettings.maxDailyLossPercent.toFixed(1)}% Max
              </span>
            </div>

            <div className="hidden sm:flex flex-col items-end border-l border-[#1b253b] pl-4">
              <span className="text-gray-500 text-[10px]">OPEN EXPOSURE SLOTS</span>
              <span className={`font-bold ${stats.openCount >= riskSettings.maxOpenTrades ? 'text-amber-400' : 'text-blue-400'}`}>
                {stats.openCount} / {riskSettings.maxOpenTrades} Active
              </span>
            </div>

            <div className="flex flex-col items-end border-l border-[#1b253b] pl-4">
              <span className="text-gray-500 text-[10px]">COORDINATED SYSTEM TIME</span>
              <span className="text-gray-300 font-bold">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
              </span>
            </div>

          </div>

        </div>
      </header>

      {/* 2. Interactive Alert Notifications Drawer */}
      {activeAlerts.length > 0 && (
        <div className="fixed top-18 right-4 z-40 max-w-sm w-full space-y-2 pointer-events-none sm:pointer-events-auto">
          {activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-3.5 rounded-lg border shadow-2xl backdrop-blur-md flex items-start space-x-3 transition-all duration-300 transform translate-y-0 ${
                alert.severity === 'high' 
                  ? 'bg-rose-950/75 border-rose-500/40 text-rose-200' 
                  : alert.severity === 'medium'
                    ? 'bg-amber-950/75 border-amber-500/40 text-amber-200'
                    : 'bg-blue-950/75 border-blue-500/40 text-blue-200'
              }`}
            >
              <BellRing className={`w-5 h-5 shrink-0 mt-0.5 ${alert.severity === 'high' ? 'animate-bounce text-rose-400' : 'text-amber-400'}`} />
              <div>
                <span className="text-[10px] font-mono leading-none font-bold uppercase tracking-wider block opacity-70">
                  {alert.type} • {alert.ticker}
                </span>
                <p className="text-xs font-sans mt-1 leading-relaxed">
                  {alert.message}
                </p>
                <span className="text-[9px] font-mono block mt-1 opacity-50">
                  Logged at {alert.timestamp}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. Main Dashboard grid layout */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-grow w-full grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left column: Watchlist - Span 3 */}
        <section className="lg:col-span-3 flex flex-col space-y-4">
          <div className="flex-1">
            <Watchlist 
              selectedTicker={selectedTicker}
              onSelectTicker={setSelectedTicker}
              onMarketStateUpdate={handleMarketStateUpdate}
            />
          </div>
          <div className="shrink-0">
            <BybitAutopilot 
              isArmed={isAutopilotArmed}
              onToggleArmed={setIsAutopilotArmed}
              openPositionCount={stats.openCount}
              selectedTicker={selectedTicker}
              onExecuteAutoTrade={handleExecuteAutoTrade}
              currentRecommendation={currentRecommendation}
            />
          </div>
        </section>

        {/* Center column: Charts layout - Span 6 */}
        <section className="lg:col-span-6 flex flex-col space-y-5">
          {/* Main Candlestick ICT Screen */}
          <div className="flex-grow">
            <ChartTerminal state={marketStates[selectedTicker]} />
          </div>

          {/* Setup Validator Card */}
          <div className="shrink-0">
            <SetupValidator 
              recommendation={currentRecommendation} 
              onApproveTrade={handleApproveTrade}
              isDailyLossBreached={stats.dailyLossPercent >= riskSettings.maxDailyLossPercent}
              isOpenLimitsReached={stats.openCount >= riskSettings.maxOpenTrades}
            />
          </div>
        </section>

        {/* Right column: Risk, Journal, and AI Copilot - Span 3 */}
        <section className="lg:col-span-3 flex flex-col space-y-5">
          {/* AI Copilot chat */}
          <div className="flex-grow">
            <CopilotChat 
              selectedTicker={selectedTicker}
              marketState={marketStates[selectedTicker]}
              lastRecommendation={currentRecommendation}
            />
          </div>

          {/* Risk parameters */}
          <div className="shrink-0">
            <RiskManager 
              settings={riskSettings}
              onSettingsChange={setRiskSettings}
              openCount={stats.openCount}
              unrealizedPnlPercent={stats.unrealizedPnlPercent}
              dailyLossPercent={stats.dailyLossPercent}
              consecutiveLosses={stats.consecutiveLosses}
            />
          </div>
        </section>

        {/* Bottom Section: Trade Journal spanning full width - Span 12 */}
        <section className="lg:col-span-12">
          <Journal 
            entries={journalEntries}
            onClosePosition={handleClosePosition}
            currentPrices={currentPrices}
          />
        </section>

      </main>

      {/* 4. Humble professional margin footer and metadata status lines */}
      <footer className="bg-[#0b0f19] border-t border-[#1b253b] py-3 mt-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center text-[10px] text-gray-500 font-mono">
          <span>
            © 2026 TRADEBRAIN ICT SYSTEMS CORP • ALL RIGHTS RESTRAINED
          </span>
          <span className="flex items-center space-x-1.5 mt-2 sm:mt-0">
            <span>NETWORK CORE:</span>
            <span className="text-emerald-450 text-emerald-400 font-bold bg-[#10b981]/10 px-1.5 py-0.5 rounded">ONLINE</span>
            <span>DATA BINANCE STREAM FEED: ACTIVE</span>
          </span>
        </div>
      </footer>

    </div>
  );
}
