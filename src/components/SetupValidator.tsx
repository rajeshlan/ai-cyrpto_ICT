/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { AssetTicker, TradeRecommendation, TradeJournalEntry, SetupGrade } from '../types';
import { ShieldCheck, ArrowUpRight, ArrowDownRight, CheckCircle2, TrendingUp, AlertCircle } from 'lucide-react';

interface SetupValidatorProps {
  recommendation: TradeRecommendation | null;
  onApproveTrade: (trade: Omit<TradeJournalEntry, 'id' | 'openTime' | 'closeTime' | 'status'>) => void;
  isDailyLossBreached: boolean;
  isOpenLimitsReached: boolean;
}

export default function SetupValidator({ 
  recommendation, 
  onApproveTrade,
  isDailyLossBreached,
  isOpenLimitsReached
}: SetupValidatorProps) {
  
  const scorecardItems = useMemo(() => {
    if (!recommendation) return [];
    const sc = recommendation.scoreCard;
    return [
      { label: 'Market Structure Alignment', value: sc.marketStructure, max: 25 },
      { label: 'Liquidity Sweep Confirmation', value: sc.liquidity, max: 15 },
      { label: 'Fair Value Gap (FVG) Presence', value: sc.fvg, max: 15 },
      { label: 'Order Block (OB) Validation', value: sc.orderBlock, max: 15 },
      { label: 'Premium / Discount Equilibrium Retracement', value: sc.premiumDiscount, max: 10 },
      { label: 'Volume Spike & FlowPulse Acceleration', value: sc.volume, max: 10 },
      { label: 'HTF (1H/4H) Trend Anchor Concordance', value: sc.htfAlignment, max: 10 },
    ];
  }, [recommendation]);

  if (!recommendation) {
    return (
      <div className="bg-[#0b0f19] border border-[#1b253b] rounded-lg p-5 h-full flex items-center justify-center text-gray-500 font-mono text-xs">
        <AlertCircle className="w-4 h-4 mr-1.5 text-amber-500 animate-pulse" />
        WAITING FOR NEW STABLE STRUCTURE SETUP GENERATION...
      </div>
    );
  }

  const isLong = recommendation.direction === 'LONG';
  const grade = recommendation.grade;
  const totalScore = recommendation.scoreCard.total;

  const getGradeColor = (g: SetupGrade) => {
    switch (g) {
      case 'A+': return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40 font-black';
      case 'A': return 'text-green-400 bg-green-500/10 border-green-500/30';
      case 'B': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'C': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'REJECT': return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    }
  };

  const handleManualApproval = () => {
    if (grade === 'REJECT') return;
    
    // Pass to parent handler to open a position
    onApproveTrade({
      ticker: recommendation.ticker,
      direction: recommendation.direction,
      entryPrice: (recommendation.entryZone.start + recommendation.entryZone.end) / 2, // middle of entry zone
      exitPrice: 0,
      quantity: recommendation.ticker === 'BTCUSDT' ? 0.05 : recommendation.ticker === 'ETHUSDT' ? 1.0 : 15.0,
      pnl: 0,
      pnlPercent: 0,
      riskAmount: 100, // standard default $100
      setupType: `ICT ${grade} Grade Structure Break`,
      notes: `Manual execution approved based on OrderBlock retest. Expected RR: ${recommendation.riskRewardRatio.toFixed(2)}:1.`
    });
  };

  const isBlocked = isDailyLossBreached || isOpenLimitsReached;
  const isRejected = grade === 'REJECT';

  return (
    <div className="bg-[#0b0f19] border border-[#1b253b] rounded-lg p-5 flex flex-col justify-between h-full shadow-xl shadow-black/35 select-none">
      
      {/* Title & Setup Score */}
      <div>
        <div className="flex justify-between items-center border-b border-[#1b253b] pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400 animate-pulse" />
            <h2 className="text-sm font-semibold tracking-wide text-gray-200">INSTITUTIONAL SETUP VALIDATOR</h2>
          </div>

          <div className="flex items-center space-x-2">
            <span className={`text-xs px-2 py-0.5 rounded border border-solid tracking-wider font-mono ${getGradeColor(grade)}`}>
              GRADE {grade}
            </span>
            <span className="font-mono text-xs text-gray-400 font-bold">
              Score: <strong className="text-white text-sm">{totalScore}</strong>/100
            </span>
          </div>
        </div>

        {/* 100-Point Score Grid */}
        <div className="space-y-2 mb-5">
          <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider font-mono">100-Point ICT Scorecard Matrix</h3>
          <div className="space-y-1.5">
            {scorecardItems.map((item, index) => (
              <div key={index} className="space-y-0.5 text-[11px]">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-gray-400">{item.label}</span>
                  <span className="text-gray-200 font-semibold">{item.value} / {item.max}</span>
                </div>
                {/* Visual bar */}
                <div className="w-full h-1 bg-[#090d18] rounded-full overflow-hidden border border-[#1b253b]/40">
                  <div 
                    className={`h-full rounded-full ${
                      isRejected ? 'bg-rose-500' :
                      item.value > (item.max * 0.8) ? 'bg-emerald-400' : 
                      item.value > (item.max * 0.5) ? 'bg-blue-400' : 'bg-amber-400'
                    }`}
                    style={{ width: `${(item.value / item.max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trade Parameters Model Block */}
        <div className="bg-[#070a12] border border-[#1b253b] rounded-lg p-3.5 mb-5 space-y-3.5">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              {isLong ? (
                <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-md flex items-center text-xs font-bold font-sans">
                  <ArrowUpRight className="w-4 h-4 mr-1 stroke-[2.5]" />
                  EXECUTE BUY-SIDE LONG MODEL
                </div>
              ) : (
                <div className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-md flex items-center text-xs font-bold font-sans">
                  <ArrowDownRight className="w-4 h-4 mr-1 stroke-[2.5]" />
                  EXECUTE SELL-SIDE SHORT MODEL
                </div>
              )}
            </div>
            
            <div className="text-right text-[10px] font-mono text-gray-500 uppercase">
              Win Prop: <strong className="text-gray-200 text-xs">{recommendation.winProbabilityEstimate}%</strong>
            </div>
          </div>

          {/* Parameters grid */}
          <div className="grid grid-cols-2 gap-3 pb-3 border-b border-[#1b253b]/60">
            <div>
              <span className="text-[10px] text-gray-500 font-mono block">LIMIT ENTRY ZONE</span>
              <span className="text-[13px] font-mono font-bold text-[#60a5fa]">
                ${recommendation.entryZone.start.toLocaleString(undefined, { maximumFractionDigits: 2 })} - ${recommendation.entryZone.end.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-gray-500 font-mono block">INVALIDITY (STOP LOSS)</span>
              <span className="text-[13px] font-mono font-bold text-rose-400">
                ${recommendation.stopLoss.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="text-[9px] text-gray-500 font-mono block">TAKE PROFIT 1</span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                ${recommendation.tp1.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-gray-500 font-mono block">TAKE PROFIT 2</span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                ${recommendation.tp2.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-gray-500 font-mono block">TAKE PROFIT 3</span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                ${recommendation.tp3.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs bg-[#0d1424] px-2.5 py-1.5 rounded border border-[#1b253b]">
            <span className="text-gray-400 font-mono uppercase text-[10px]">RISK-TO-REWARD RATIO:</span>
            <span className="font-mono text-gray-100 font-extrabold text-xs">
              {recommendation.riskRewardRatio.toFixed(2)} : 1.00
            </span>
          </div>
        </div>

        {/* Structural narrative explain */}
        <div className="text-[10px] text-gray-400 leading-relaxed font-sans bg-[#0c1322]/30 border border-[#1b253b]/50 p-3 rounded-md">
          <strong className="text-blue-400 font-semibold font-mono block mb-1">MODEL NARRATIVE ANALYSIS:</strong>
          {recommendation.explanation}
        </div>
      </div>

      {/* Manual approval action triggers */}
      <div className="mt-4 pt-3 border-t border-[#1b253b]">
        {isRejected ? (
          <div className="flex items-center justify-center p-3 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
            <AlertCircle className="w-4.5 h-4.5 mr-2" />
            MODEL SHIELD: SETUP REJECTED FOR LOW QUALITY (SCORE &lt; 75).
          </div>
        ) : isBlocked ? (
          <div className="flex items-center justify-center p-3 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono">
            <AlertCircle className="w-4.5 h-4.5 mr-2" />
            RISK LIMIT BLOCK: DAILY LOSS OR OPEN POSITION COUNT EXCEEDED.
          </div>
        ) : (
          <button
            onClick={handleManualApproval}
            className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-[#1e40af] hover:from-blue-500 hover:to-blue-600 border border-blue-400/20 font-sans font-bold text-xs text-white uppercase py-3 rounded-lg shadow-lg cursor-pointer hover:shadow-blue-500/10 transition-all"
          >
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 fill-emerald-400/20" />
            <span>APPROVE & LOG TO LIVE JOURNAL (MANUAL DISPATCH)</span>
          </button>
        )}
      </div>

    </div>
  );
}
