/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { AssetTicker, ConnectionStatus, MarketState } from '../types';
import { wsService } from '../services/websocketSim';
import { Wifi, WifiOff, RefreshCw, Layers, Radio, Terminal } from 'lucide-react';

interface WatchlistProps {
  selectedTicker: AssetTicker;
  onSelectTicker: (ticker: AssetTicker) => void;
  onMarketStateUpdate: (ticker: AssetTicker, state: MarketState) => void;
}

export default function Watchlist({ 
  selectedTicker, 
  onSelectTicker, 
  onMarketStateUpdate 
}: WatchlistProps) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [latency, setLatency] = useState<number>(0);
  const [states, setStates] = useState<Record<AssetTicker, MarketState | null>>({
    BTCUSDT: null,
    ETHUSDT: null,
    SOLUSDT: null,
  });
  const [wsLogs, setWsLogs] = useState<string[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);
  
  // Track previous prices to flash green/red on change
  const prevPrices = useRef<Record<AssetTicker, number>>({
    BTCUSDT: 0,
    ETHUSDT: 0,
    SOLUSDT: 0,
  });

  const [priceFlash, setPriceFlash] = useState<Record<AssetTicker, 'up' | 'down' | null>>({
    BTCUSDT: null,
    ETHUSDT: null,
    SOLUSDT: null,
  });

  useEffect(() => {
    // 1. Subscribe to WS Connection status
    const unsubStatus = wsService.subscribeToStatus((currStatus, currLatency) => {
      setStatus(currStatus);
      setLatency(currLatency);
    });

    // 2. Subscribe to logs
    const unsubLogs = wsService.subscribeToLogs((log) => {
      setWsLogs((prev) => {
        const next = [...prev, log];
        return next.slice(-40); // Keep last 40 lines
      });
    });

    // 3. Subscribe to specific market states
    const assets: AssetTicker[] = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
    const unsubs = assets.map((ticker) => {
      return wsService.subscribeToMarket(ticker, (state) => {
        const prevPrice = prevPrices.current[ticker];
        if (prevPrice && prevPrice !== state.price) {
          const mainDir = state.price > prevPrice ? 'up' : 'down';
          setPriceFlash(prev => ({ ...prev, [ticker]: mainDir }));
          // Reset flash after 800ms
          setTimeout(() => {
            setPriceFlash(prev => ({ ...prev, [ticker]: null }));
          }, 800);
        }
        
        prevPrices.current[ticker] = state.price;
        setStates((prev) => ({ ...prev, [ticker]: state }));
        onMarketStateUpdate(ticker, state);
      });
    });

    return () => {
      unsubStatus();
      unsubLogs();
      unsubs.forEach((u) => u());
    };
  }, [onMarketStateUpdate]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [wsLogs]);

  const handleConnectionToggle = () => {
    if (status === 'connected') {
      wsService.disconnect();
    } else {
      wsService.connect();
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'reconnecting': return 'text-amber-400 bg-amber-500/10 border-amber-500/30 animate-pulse';
      case 'disconnected': return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'connected': return <Wifi className="w-4 h-4 text-emerald-400 mr-1.5" />;
      case 'reconnecting': return <RefreshCw className="w-4 h-4 text-amber-400 mr-1.5 animate-spin" />;
      case 'disconnected': return <WifiOff className="w-4 h-4 text-rose-400 mr-1.5" />;
    }
  };

  return (
    <div className="bg-[#0b0f19] border border-[#1b253b] rounded-lg p-4 h-full flex flex-col justify-between select-none shadow-xl shadow-black/40">
      {/* Top Bar: Live Status Indicators */}
      <div>
        <div className="flex items-center justify-between border-b border-[#1b253b] pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <Radio className="w-5 h-5 text-[#3b82f6] animate-pulse" />
            <h2 className="text-sm font-semibold tracking-wide text-gray-200">LIVE COCKPIT FEED</h2>
          </div>
          
          <button 
            onClick={handleConnectionToggle}
            className={`flex items-center text-xs px-2.5 py-1 border rounded font-mono ${getStatusColor()} cursor-pointer hover:bg-white/5 transition-all`}
            title="Toggle Live WebSocket Feed"
          >
            {getStatusIcon()}
            <span className="uppercase tracking-wide font-medium">{status}</span>
          </button>
        </div>

        {/* Latency Meter */}
        {status === 'connected' && (
          <div className="flex justify-between items-center bg-[#0d1424] border border-[#1b253b] rounded-md px-3 py-1.5 mb-4 text-xs">
            <span className="text-gray-400">Bybit Linear latency:</span>
            <span className={`font-mono font-semibold ${latency < 25 ? 'text-emerald-400' : 'text-amber-400'}`}>
              ● {latency} ms
            </span>
          </div>
        )}

        {/* Watchlist table */}
        <div className="space-y-2">
          {(Object.keys(states) as AssetTicker[]).map((ticker) => {
            const state = states[ticker];
            if (!state) return null;

            const isSelected = selectedTicker === ticker;
            const flash = priceFlash[ticker];
            const priceChange = state.priceChangePercent;
            const isChangePositive = priceChange >= 0;

            let flashBg = '';
            if (flash === 'up') flashBg = 'bg-emerald-500/20';
            else if (flash === 'down') flashBg = 'bg-rose-500/20';

            return (
              <div
                key={ticker}
                id={`watchlist-item-${ticker}`}
                onClick={() => onSelectTicker(ticker)}
                className={`group flex items-center justify-between p-3 rounded-lg border cursor-pointer select-none transition-all duration-300 ${
                  isSelected 
                    ? 'bg-[#121c33]/80 border-[#3b82f6]/60 shadow-lg shadow-blue-500/5' 
                    : 'bg-[#0f1526]/50 border-[#1b253b] hover:bg-[#121c33]/40 hover:border-[#1b253b]/80'
                } ${flashBg}`}
              >
                <div className="flex items-center space-x-2.5">
                  <div className={`w-1.5 h-7 rounded-sm ${isSelected ? 'bg-[#3b82f6]' : 'bg-[#1b253b] group-hover:bg-[#121c33]'}`} />
                  <div>
                    <h3 className="font-sans font-bold text-sm tracking-tight text-gray-200 group-hover:text-white">
                      {ticker.replace("USDT", "")}
                      <span className="text-gray-500 text-xs font-mono font-medium block">/USDT</span>
                    </h3>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end">
                  <span className={`text-[15px] font-mono leading-tight tracking-tight font-bold transition-all duration-300 ${
                    flash === 'up' 
                      ? 'text-emerald-400 font-extrabold scale-102' 
                      : flash === 'down' 
                        ? 'text-rose-400 font-extrabold scale-102' 
                        : 'text-gray-100'
                  }`}>
                    ${state.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded font-semibold ${
                      isChangePositive 
                        ? 'text-emerald-400 bg-emerald-500/10' 
                        : 'text-rose-400 bg-rose-500/10'
                    }`}>
                      {isChangePositive ? '+' : ''}{priceChange.toFixed(2)}%
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono tracking-tight uppercase">
                      Bias: <strong className={state.bias === 'BULLISH' ? 'text-emerald-400' : 'text-rose-400'}>{state.bias}</strong>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Raw WebSocket Frame Log */}
      <div className="mt-5 border-t border-[#1b253b] pt-4">
        <div className="flex items-center space-x-2 mb-2 text-xs font-semibold tracking-wide text-gray-400">
          <Terminal className="w-3.5 h-3.5 text-blue-400" />
          <span>SOCKET FLOW DISPATCHER</span>
        </div>
        
        <div 
          ref={logContainerRef}
          className="h-32 rounded bg-[#070a12] border border-[#1b253b]/60 p-2 font-mono text-[9px] text-[#5c6f96] overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-gray-800"
        >
          {status === 'disconnected' ? (
            <div className="text-rose-400/70 italic text-center pt-8">
              [SYSTEM DISCONNECTED] Toggle feed to inspect linear frames.
            </div>
          ) : (
            wsLogs.map((log, index) => {
              const isAlert = log.includes("[ALERT]");
              const isFvg = log.includes("[FVG Engine]");
              const isOb = log.includes("[OB Engine]");
              let color = 'text-gray-500';
              if (isAlert) color = 'text-amber-400 font-medium';
              else if (isFvg) color = 'text-emerald-400';
              else if (isOb) color = 'text-blue-400';
              
              return (
                <div key={index} className={`break-all leading-normal ${color}`}>
                  {log}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
