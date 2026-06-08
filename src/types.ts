/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AssetTicker = 'BTCUSDT' | 'ETHUSDT' | 'SOLUSDT';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export type StructureBias = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface StructureShift {
  type: 'MSS' | 'BOS' | 'CHOCH';
  price: number;
  time: string;
  confirmed: boolean;
}

export interface FVG {
  id: string;
  type: 'BULLISH' | 'BEARISH';
  high: number;
  low: number;
  size: number;
  ageBars: number;
  fillPercentage: number; // 0 to 100
  strength: 'STRONG' | 'MEDIUM' | 'WEAK';
}

export interface OrderBlock {
  id: string;
  type: 'BULLISH' | 'BEARISH';
  topPrice: number;
  bottomPrice: number;
  mitigated: boolean;
  displacement: number; // percentage displacement
}

export interface LiquidityPool {
  id: string;
  type: 'BSL' | 'SSL';
  price: number;
  strength: number; // 1 to 5 stars
  swept: boolean;
  distancePct: number; // current distance in percentage
}

export interface PremiumDiscount {
  equilibrium: number;
  premiumZone: { start: number; end: number };
  discountZone: { start: number; end: number };
  optimalTradeEntry: { start: number; end: number }; // 0.62 to 0.79 retracement
}

export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketState {
  ticker: AssetTicker;
  price: number;
  priceChangePercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  bias: StructureBias;
  biasConfidence: number; // 0 to 100
  shifts: StructureShift[];
  fvgs: FVG[];
  orderBlocks: OrderBlock[];
  liquidityPools: LiquidityPool[];
  premiumDiscount: PremiumDiscount;
  flowPulseScore: number; // 0 to 100
  flowPulseDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  candles: Candle[];
}

export type SetupGrade = 'A+' | 'A' | 'B' | 'C' | 'REJECT';

export interface SetupScorecard {
  marketStructure: number; // max 25
  liquidity: number; // max 15
  fvg: number; // max 15
  orderBlock: number; // max 15
  premiumDiscount: number; // max 10
  volume: number; // max 10
  htfAlignment: number; // max 10
  total: number; // 0 to 100
}

export interface TradeRecommendation {
  ticker: AssetTicker;
  direction: 'LONG' | 'SHORT';
  entryZone: { start: number; end: number };
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  riskRewardRatio: number;
  winProbabilityEstimate: number; // 0 to 100
  confidenceScore: number; // 0 to 100
  grade: SetupGrade;
  scoreCard: SetupScorecard;
  explanation: string;
  timestamp: string;
}

export interface Alert {
  id: string;
  ticker: AssetTicker;
  type: 'NEW_SETUP' | 'LIQUIDITY_SWEEP' | 'VOL_SPIKE' | 'RISK_EVENT' | 'TRADE_COMPLETED';
  message: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
}

export interface TradeJournalEntry {
  id: string;
  ticker: AssetTicker;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  riskAmount: number;
  setupType: string;
  status: 'OPEN' | 'WIN' | 'LOSS' | 'BREAKEVEN';
  openTime: string;
  closeTime: string;
  notes: string;
}

export interface RiskSettings {
  riskPerTradePercent: number; // default: 1%
  maxDailyLossPercent: number; // default: 3%
  maxOpenTrades: number; // default: 3
  maxExposurePercent: number; // default: 5%
  maxConsecutiveLosses: number; // default: 3
}

export interface CopilotMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  contextInfo?: {
    ticker?: AssetTicker;
    setupGrade?: SetupGrade;
    price?: number;
  };
}
