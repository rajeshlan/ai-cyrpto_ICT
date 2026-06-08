/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { MarketState } from '../types';
import { TrendingUp, TrendingDown, Eye, Activity, Map, ArrowRight } from 'lucide-react';

interface ChartTerminalProps {
  state: MarketState | null;
}

export default function ChartTerminal({ state }: ChartTerminalProps) {
  if (!state) {
    return (
      <div className="bg-[#0b0f19] border border-[#1b253b] rounded-lg p-6 h-full flex items-center justify-center text-gray-500 font-mono">
        <Activity className="w-6 h-6 animate-spin mr-3 text-blue-500" />
        <span>BOOTING STRUCTURE SHIFT DETECTION ENGINE...</span>
      </div>
    );
  }

  const tickerName = state.ticker.replace("USDT", "");
  const isUp = state.priceChangePercent >= 0;

  // Let's create an SVG scale layout for the candies.
  // We discover the min/max prices of the candies to scale them nicely.
  const { minPrice, maxPrice, scaleY, candleWidthFull, spaceWidth, chartHeight, chartWidth } = useMemo(() => {
    const candles = state.candles;
    if (candles.length === 0) {
      return { minPrice: 0, maxPrice: 100, scaleY: () => 0, candleWidthFull: 10, spaceWidth: 2, chartHeight: 340, chartWidth: 640 };
    }

    const minP = Math.min(...candles.map(c => c.low), state.price) * 0.995;
    const maxP = Math.max(...candles.map(c => c.high), state.price) * 1.005;
    const diff = maxP - minP;
    const cHeight = 300;
    const cWidth = 640;

    const scale = (val: number) => {
      // Scale to chartHeight (inverted so higher prices are at the top)
      return cHeight - ((val - minP) / diff) * (cHeight - 40) - 20;
    };

    const cFullWidth = cWidth / candles.length;
    
    return {
      minPrice: minP,
      maxPrice: maxP,
      scaleY: scale,
      candleWidthFull: cFullWidth,
      spaceWidth: cFullWidth * 0.15,
      chartHeight: cHeight,
      chartWidth: cWidth,
    };
  }, [state.candles, state.price]);

  // Compute positions of active Fair Value Gaps
  const fvgRects = useMemo(() => {
    return state.fvgs.map((fvg, idx) => {
      const topY = scaleY(fvg.high);
      const bottomY = scaleY(fvg.low);
      const height = Math.abs(bottomY - topY);
      
      // Let's position FVGs visually in the center-left columns
      const widthPct = fvg.strength === 'STRONG' ? (100 - fvg.fillPercentage) / 100 : 0.35;
      const xStart = chartWidth * (0.2 + idx * 0.15);
      const xEnd = xStart + chartWidth * 0.3 * widthPct;

      return {
        id: fvg.id,
        type: fvg.type,
        x: xStart,
        width: Math.max(40, xEnd - xStart),
        top: topY,
        height,
        strength: fvg.strength,
        fillPercent: fvg.fillPercentage,
        rawHigh: fvg.high,
        rawLow: fvg.low
      };
    });
  }, [state.fvgs, scaleY, chartWidth]);

  // Compute OrderBlocks coordinates
  const obRects = useMemo(() => {
    return state.orderBlocks.map((ob, idx) => {
      const topY = scaleY(ob.topPrice);
      const bottomY = scaleY(ob.bottomPrice);
      const height = Math.abs(bottomY - topY);
      
      const xStart = chartWidth * 0.45;
      const width = chartWidth * 0.55;

      return {
        id: ob.id,
        type: ob.type,
        x: xStart,
        width,
        top: topY,
        height,
        mitigated: ob.mitigated,
        rawTop: ob.topPrice,
        rawBottom: ob.bottomPrice
      };
    });
  }, [state.orderBlocks, scaleY, chartWidth]);

  // Premium / Discount zones representation
  const equilibriumY = scaleY(state.premiumDiscount.equilibrium);
  const oteStartY = scaleY(state.premiumDiscount.optimalTradeEntry.start);
  const oteEndY = scaleY(state.premiumDiscount.optimalTradeEntry.end);

  return (
    <div className="bg-[#0b0f19] border border-[#1b253b] rounded-lg p-5 flex flex-col justify-between h-full shadow-xl shadow-black/35 select-none">
      {/* Header Info */}
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[#1b253b] pb-3 mb-4 space-y-2 sm:space-y-0">
          <div>
            <div className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${state.bias === 'BULLISH' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400 animate-pulse'}`} />
              <h1 className="text-lg font-bold tracking-tight text-white font-sans flex items-center">
                {tickerName}/USDT Linear Terminal
                <span className="ml-2.5 text-xs font-semibold px-2 py-0.5 rounded-sm bg-[#1e294b] text-blue-400 border border-blue-500/10 uppercase tracking-wider font-mono">
                  Execution 5m
                </span>
              </h1>
            </div>
            
            <p className="text-xs text-gray-500 mt-0.5 font-mono">
              Live ticks synced over Bybit feed • High volume context
            </p>
          </div>

          <div className="flex space-x-4">
            <div className="text-right">
              <div className="text-[10px] uppercase text-gray-500 font-mono tracking-wider font-semibold">Live Price</div>
              <div className={`text-base font-mono font-bold leading-tight tracking-tight flex items-center ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isUp ? <TrendingUp className="w-4 h-4 mr-1 text-emerald-400" /> : <TrendingDown className="w-4 h-4 mr-1 text-rose-400" />}
                ${state.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] uppercase text-gray-500 font-mono tracking-wider font-semibold">FlowPulse Status</div>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${
                  state.flowPulseDirection === 'BULLISH' ? 'text-emerald-400 bg-emerald-500/10' :
                  state.flowPulseDirection === 'BEARISH' ? 'text-rose-400 bg-rose-500/10' : 'text-gray-400 bg-gray-500/10'
                }`}>
                  {state.flowPulseScore} Index
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* The Graphic Canvas Chart */}
        <div className="relative bg-[#070a12] border border-[#1b253b] rounded-md overflow-hidden" id="svg-chart-panel">
          
          {/* Legend HUD overlay */}
          <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2 text-[9px] font-mono select-none pointer-events-none">
            <span className="flex items-center px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5" /> OB ORDER BLOCK
            </span>
            <span className="flex items-center px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/20 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded bg-emerald-500 mr-1.5" /> BULLISH FVG
            </span>
            <span className="flex items-center px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/20 text-rose-400">
              <span className="w-1.5 h-1.5 rounded bg-rose-500 mr-1.5" /> BEARISH FVG
            </span>
            <span className="flex items-center px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <span className="w-1.5 h-0.5 bg-amber-400 mr-1.5 inline-block" /> OTE ENTRY GRID
            </span>
          </div>

          {/* SVG Canvas drawing */}
          <svg 
            width="100%" 
            height={chartHeight} 
            viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
            preserveAspectRatio="none"
            className="w-full h-[300px]"
          >
            {/* Grid Lines */}
            <line x1="0" y1={chartHeight * 0.25} x2={chartWidth} y2={chartHeight * 0.25} stroke="#1b253b" strokeOpacity="0.3" strokeDasharray="3 3" />
            <line x1="0" y1={chartHeight * 0.5} x2={chartWidth} y2={chartHeight * 0.5} stroke="#1b253b" strokeOpacity="0.3" strokeDasharray="3 3" />
            <line x1="0" y1={chartHeight * 0.75} x2={chartWidth} y2={chartHeight * 0.75} stroke="#1b253b" strokeOpacity="0.3" strokeDasharray="3 3" />
            
            {/* Vertical column markers */}
            <line x1={chartWidth * 0.2} y1="0" x2={chartWidth * 0.2} y2={chartHeight} stroke="#1b253b" strokeOpacity="0.3" strokeDasharray="3 3" />
            <line x1={chartWidth * 0.4} y1="0" x2={chartWidth * 0.4} y2={chartHeight} stroke="#1b253b" strokeOpacity="0.3" strokeDasharray="3 3" />
            <line x1={chartWidth * 0.6} y1="0" x2={chartWidth * 0.6} y2={chartHeight} stroke="#1b253b" strokeOpacity="0.3" strokeDasharray="3 3" />
            <line x1={chartWidth * 0.8} y1="0" x2={chartWidth * 0.8} y2={chartHeight} stroke="#1b253b" strokeOpacity="0.3" strokeDasharray="3 3" />

            {/* DRAW: Premium / Discount Equilibrium division line */}
            <g>
              <line 
                x1={100} 
                y1={equilibriumY} 
                x2={chartWidth} 
                y2={equilibriumY} 
                stroke="#64748b" 
                strokeWidth="1" 
                strokeDasharray="4 4" 
              />
              <text 
                x={120} 
                y={equilibriumY - 4} 
                fill="#94a3b8" 
                fontSize="8" 
                fontFamily="monospace"
                className="font-semibold"
              >
                EQUILIBRIUM MIDPOINT: ${state.premiumDiscount.equilibrium.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </text>
            </g>

            {/* DRAW: Optimal Trade Entry (OTE) Retracement range */}
            <g>
              <rect 
                x={150} 
                y={Math.min(oteStartY, oteEndY)} 
                width={chartWidth - 150} 
                height={Math.abs(oteEndY - oteStartY)} 
                fill="#f59e0b" 
                fillOpacity="0.08" 
              />
              <line 
                x1={150} 
                y1={oteStartY} 
                x2={chartWidth} 
                y2={oteStartY} 
                stroke="#d97706" 
                strokeWidth="0.8" 
                strokeDasharray="2 2" 
              />
              <line 
                x1={150} 
                y1={oteEndY} 
                x2={chartWidth} 
                y2={oteEndY} 
                stroke="#d97706" 
                strokeWidth="0.8" 
                strokeDasharray="2 2" 
              />
              <text 
                x={160} 
                y={oteStartY + 12} 
                fill="#f59e0b" 
                fontSize="8" 
                fontFamily="monospace" 
                className="font-bold fill-amber-500/90"
              >
                OPTIMAL TRADE ENTRY ZONE (62% - 79% RETRACEMENT)
              </text>
            </g>

            {/* DRAW: Fair Value Gaps (FVG) shaded rects */}
            {fvgRects.map((fvg, idx) => {
              const colorClass = fvg.type === 'BULLISH' ? '#10b981' : '#f43f5e';
              return (
                <g key={fvg.id}>
                  <rect 
                    x={fvg.x} 
                    y={fvg.top} 
                    width={fvg.width} 
                    height={fvg.height} 
                    fill={colorClass} 
                    fillOpacity="0.14" 
                    stroke={colorClass}
                    strokeWidth="0.5"
                    strokeDasharray={fvg.fillPercent >= 100 ? "1 2" : undefined}
                  />
                  <text 
                    x={fvg.x + 4} 
                    y={fvg.top + 10} 
                    fill={colorClass} 
                    fontSize="7" 
                    fontFamily="monospace"
                  >
                    FVG: {fvg.fillPercent}% FILLED {fvg.fillPercent >= 100 ? '(MITIGATED)' : ''}
                  </text>
                </g>
              );
            })}

            {/* DRAW: Institutional Order Blocks (OB) shaded areas */}
            {obRects.map((ob) => {
              const colorClass = ob.type === 'BULLISH' ? '#3b82f6' : '#d97706';
              return (
                <g key={ob.id}>
                  <rect 
                    x={ob.x} 
                    y={ob.top} 
                    width={ob.width} 
                    height={ob.height} 
                    fill={colorClass} 
                    fillOpacity={ob.mitigated ? "0.03" : "0.15"} 
                    stroke={colorClass}
                    strokeWidth="1"
                    strokeOpacity={ob.mitigated ? "0.2" : "0.7"}
                    strokeDasharray={ob.mitigated ? "2 2" : undefined}
                  />
                  <text 
                    x={ob.x + 8} 
                    y={ob.top + 12} 
                    fill={colorClass} 
                    fillOpacity={ob.mitigated ? 0.35 : 0.9}
                    fontSize="7" 
                    fontFamily="monospace"
                    className="font-bold"
                  >
                    {ob.type} OB ZONE {ob.mitigated ? '(MITIGATED)' : '(UNMITIGATED)'}
                  </text>
                </g>
              );
            })}

            {/* DRAW: Liquidity Pool magnets swing line markers */}
            {state.liquidityPools.map((pool) => {
              const y = scaleY(pool.price);
              const color = pool.type === 'BSL' ? '#f43f5e' : '#10b981';
              return (
                <g key={pool.id}>
                  <line 
                    x1="0" 
                    y1={y} 
                    x2={chartWidth} 
                    y2={y} 
                    stroke={color} 
                    strokeWidth={pool.swept ? "0.5" : "1"} 
                    strokeDasharray="4 6" 
                    strokeOpacity={pool.swept ? "0.3" : "0.85"}
                  />
                  
                  {/* Indicator Box */}
                  <rect 
                    x={chartWidth - 145} 
                    y={y - 7} 
                    width="140" 
                    height="14" 
                    rx="2"
                    fill="#0b0f19" 
                    stroke={color}
                    strokeWidth="0.8"
                    strokeOpacity={pool.swept ? "0.3" : "0.8"}
                  />
                  <text 
                    x={chartWidth - 140} 
                    y={y + 3} 
                    fill={color} 
                    fillOpacity={pool.swept ? 0.4 : 1}
                    fontSize="7.5" 
                    fontFamily="monospace" 
                    className="font-semibold"
                  >
                    {pool.type}: ${pool.price.toLocaleString(undefined, { maximumFractionDigits: 1 })} {pool.swept ? '(SWEPT)' : `(${pool.distancePct.toFixed(1)}%)`}
                  </text>
                </g>
              );
            })}

            {/* DRAW: Standard Candlesticks */}
            {state.candles.map((candle, idx) => {
              const xCenter = idx * candleWidthFull + candleWidthFull / 2;
              const openY = scaleY(candle.open);
              const closeY = scaleY(candle.close);
              const highY = scaleY(candle.high);
              const lowY = scaleY(candle.low);
              
              const isBull = candle.close >= candle.open;
              const bodyColor = isBull ? '#10b981' : '#f43f5e';
              const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));
              const bodyTop = Math.min(openY, closeY);

              return (
                <g key={idx} opacity="0.85">
                  {/* Wick line */}
                  <line 
                    x1={xCenter} 
                    y1={highY} 
                    x2={xCenter} 
                    y2={lowY} 
                    stroke={bodyColor} 
                    strokeWidth="1.2" 
                  />
                  {/* Body box */}
                  <rect 
                    x={idx * candleWidthFull + spaceWidth} 
                    y={bodyTop} 
                    width={candleWidthFull - spaceWidth * 2} 
                    height={bodyHeight} 
                    fill={isBull ? '#0f172a' : bodyColor} // Hollow bulls, solid bears like institutional TV layouts
                    stroke={bodyColor}
                    strokeWidth="1.2"
                  />
                </g>
              );
            })}

            {/* DRAW: CHOCH / MSS Structure Break labels */}
            {state.shifts.map((shift, sIdx) => {
              // Plot shift markers visually at top level of chart centered
              const obY = scaleY(shift.price);
              return (
                <g key={sIdx}>
                  <circle 
                    cx={chartWidth * (0.3 + sIdx * 0.25)} 
                    cy={obY} 
                    r="4.5" 
                    fill="#3b82f6" 
                    stroke="#ffffff" 
                    strokeWidth="1" 
                  />
                  <rect 
                    x={chartWidth * (0.3 + sIdx * 0.25) - 15} 
                    y={obY - 18} 
                    width="30" 
                    height="10" 
                    rx="1.5"
                    fill="#1e293b" 
                    stroke="#3b82f6" 
                    strokeWidth="0.8" 
                  />
                  <text 
                    x={chartWidth * (0.3 + sIdx * 0.25)} 
                    y={obY - 10} 
                    fill="#60a5fa" 
                    fontSize="7" 
                    fontFamily="monospace"
                    textAnchor="middle"
                    className="font-bold font-mono"
                  >
                    {shift.type}
                  </text>
                </g>
              );
            })}

            {/* DRAW: Live price ticking line with ticker block on right margin */}
            <g>
              <line 
                x1="0" 
                y1={scaleY(state.price)} 
                x2={chartWidth} 
                y2={scaleY(state.price)} 
                stroke={isUp ? "#10b981" : "#f43f5e"} 
                strokeWidth="1.2" 
                strokeDasharray="2 3 animate-pulse"
              />
              
              <rect 
                x={chartWidth - 56} 
                y={scaleY(state.price) - 8} 
                width="56" 
                height="16" 
                fill={isUp ? "#10b981" : "#f43f5e"} 
                rx="2"
              />
              <text 
                x={chartWidth - 28} 
                y={scaleY(state.price) + 3.5} 
                fill="#ffffff" 
                fontSize="8.5" 
                fontFamily="monospace" 
                textAnchor="middle"
                className="font-bold"
              >
                ${state.price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </text>
            </g>
          </svg>

          {/* Premium / Discount divisions markers */}
          <div className="absolute right-16 top-6 select-none uppercase tracking-wider font-semibold text-[8px] font-mono text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded">
            Institutional PREMIUM Zone
          </div>
          <div className="absolute right-16 bottom-6 select-none uppercase tracking-wider font-semibold text-[8px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
            Institutional DISCOUNT Zone
          </div>
        </div>
      </div>

      {/* Legend & Summary Info panel */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 border-t border-[#1b253b] pt-4">
        
        {/* Trend shift status */}
        <div className="bg-[#0f1526]/40 border border-[#1b253b]/60 rounded-md p-2.5 flex items-start space-x-2">
          <Map className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
          <div>
            <span className="text-[10px] text-gray-500 font-mono block">HTF MARKET SHIFT</span>
            <span className="text-gray-200 text-xs font-bold leading-none block mt-1">
              {state.shifts[0]?.type || 'MSS'} Shift Confirmed
            </span>
            <span className="text-[9px] text-gray-400 font-mono block mt-0.5">
              Broken structural sweep at ${state.shifts[0]?.price.toLocaleString() || 'N/A'}
            </span>
          </div>
        </div>

        {/* FVG imbalance block */}
        <div className="bg-[#0f1526]/40 border border-[#1b253b]/60 rounded-md p-2.5 flex items-start space-x-2">
          <Eye className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <span className="text-[10px] text-gray-500 font-mono block">ACTIVE INBALANCE GAP</span>
            <span className="text-gray-200 text-xs font-bold leading-none block mt-1">
              {state.fvgs.filter(f => f.fillPercentage < 100).length} Unfilled FVGs Detected
            </span>
            <span className="text-[9px] text-gray-400 font-mono block mt-0.5">
              High chance of magnetic draw to fill gaps
            </span>
          </div>
        </div>

        {/* Liquidity pools */}
        <div className="bg-[#0f1526]/40 border border-[#1b253b]/60 rounded-md p-2.5 flex items-start space-x-2 sm:col-span-2 md:col-span-1">
          <Activity className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
          <div>
            <span className="text-[10px] text-gray-500 font-mono block">LIQUIDITY TARGETS (DOL)</span>
            <span className="text-gray-200 text-xs font-bold leading-none block mt-1">
              BSL Sweep target: ${state.liquidityPools.find(p => p.type === 'BSL')?.price.toLocaleString() || 'N/A'}
            </span>
            <span className="text-[9px] text-gray-400 font-mono block mt-0.5">
              Distance remaining: {state.liquidityPools.find(p => p.type === 'BSL')?.distancePct?.toFixed(2) || '0.00'}%
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
