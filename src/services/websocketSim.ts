/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  AssetTicker, 
  MarketState, 
  ConnectionStatus, 
  Candle, 
  FVG, 
  OrderBlock, 
  LiquidityPool, 
  TradeRecommendation, 
  Alert 
} from '../types';

type MarketCallback = (state: MarketState) => void;
type StatusCallback = (status: ConnectionStatus, latency: number) => void;
type AlertCallback = (alert: Alert) => void;
type LogCallback = (log: string) => void;

class WebSocketSimulator {
  private status: ConnectionStatus = 'disconnected';
  private latency: number = 0;
  private marketCallbacks: Map<AssetTicker, Set<MarketCallback>> = new Map();
  private statusCallbacks: Set<StatusCallback> = new Set();
  private alertCallbacks: Set<AlertCallback> = new Set();
  private logCallbacks: Set<LogCallback> = new Set();
  private intervalId: NodeJS.Timeout | null = null;
  private logIntervalId: NodeJS.Timeout | null = null;
  
  // Local state cache
  private prices: Record<AssetTicker, number> = {
    BTCUSDT: 69450.50,
    ETHUSDT: 3582.40,
    SOLUSDT: 152.35,
  };

  private priceChanges: Record<AssetTicker, number> = {
    BTCUSDT: 2.34,
    ETHUSDT: -1.12,
    SOLUSDT: 4.85,
  };

  private states: Record<AssetTicker, MarketState>;

  constructor() {
    this.states = {
      BTCUSDT: this.generateInitialState('BTCUSDT', 69450.50),
      ETHUSDT: this.generateInitialState('ETHUSDT', 3582.40),
      SOLUSDT: this.generateInitialState('SOLUSDT', 152.35),
    };
    this.connect();
  }

  private generateInitialState(ticker: AssetTicker, startPrice: number): MarketState {
    const isBtc = ticker === 'BTCUSDT';
    const isEth = ticker === 'ETHUSDT';
    
    // Generate mock base candles (last 20 bars)
    const candles: Candle[] = [];
    let curPrice = startPrice * 0.98;
    const timeNow = new Date();
    
    for (let i = 20; i > 0; i--) {
      const candleTime = new Date(timeNow.getTime() - i * 5 * 60 * 1000); // 5m intervals
      const change = (Math.random() - 0.48) * (startPrice * 0.003);
      const open = curPrice;
      const close = curPrice + change;
      const high = Math.max(open, close) + Math.random() * (startPrice * 0.001);
      const low = Math.min(open, close) - Math.random() * (startPrice * 0.001);
      const volume = Math.round(50 + Math.random() * 450);
      
      candles.push({
        time: candleTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        open,
        high,
        low,
        close,
        volume,
      });
      curPrice = close;
    }

    // Set structure markers
    const equilibrium = startPrice * 0.995;
    const pRange = startPrice * 0.03;

    return {
      ticker,
      price: startPrice,
      priceChangePercent: ticker === 'BTCUSDT' ? 1.45 : ticker === 'ETHUSDT' ? -0.85 : 4.12,
      high24h: startPrice * 1.025,
      low24h: startPrice * 0.965,
      volume24h: ticker === 'BTCUSDT' ? 451200 : ticker === 'ETHUSDT' ? 2450000 : 894500,
      bias: ticker === 'ETHUSDT' ? 'BEARISH' : 'BULLISH',
      biasConfidence: ticker === 'BTCUSDT' ? 88 : ticker === 'ETHUSDT' ? 75 : 92,
      shifts: [
        { type: 'BOS', price: startPrice * 0.975, time: '10:45', confirmed: true },
        { type: 'MSS', price: startPrice * 0.985, time: '11:15', confirmed: true }
      ],
      fvgs: [
        {
          id: `${ticker}-fvg-1`,
          type: ticker === 'ETHUSDT' ? 'BEARISH' : 'BULLISH',
          high: startPrice * (ticker === 'ETHUSDT' ? 1.010 : 0.988),
          low: startPrice * (ticker === 'ETHUSDT' ? 1.002 : 0.982),
          size: 0.6,
          ageBars: 4,
          fillPercentage: 35,
          strength: 'STRONG',
        },
        {
          id: `${ticker}-fvg-2`,
          type: ticker === 'ETHUSDT' ? 'BEARISH' : 'BULLISH',
          high: startPrice * (ticker === 'ETHUSDT' ? 1.018 : 0.975),
          low: startPrice * (ticker === 'ETHUSDT' ? 1.014 : 0.971),
          size: 0.4,
          ageBars: 12,
          fillPercentage: 80,
          strength: 'MEDIUM',
        }
      ],
      orderBlocks: [
        {
          id: `${ticker}-ob-1`,
          type: ticker === 'ETHUSDT' ? 'BEARISH' : 'BULLISH',
          topPrice: startPrice * (ticker === 'ETHUSDT' ? 1.013 : 0.979),
          bottomPrice: startPrice * (ticker === 'ETHUSDT' ? 1.006 : 0.971),
          mitigated: false,
          displacement: 2.45,
        }
      ],
      liquidityPools: [
        {
          id: `${ticker}-liq-bsl`,
          type: 'BSL',
          price: startPrice * 1.015,
          strength: 4,
          swept: false,
          distancePct: 1.5,
        },
        {
          id: `${ticker}-liq-ssl`,
          type: 'SSL',
          price: startPrice * 0.972,
          strength: 5,
          swept: false,
          distancePct: 2.8,
        },
        {
          id: `${ticker}-liq-bslequal`,
          type: 'BSL',
          price: startPrice * 1.022,
          strength: 3,
          swept: false,
          distancePct: 2.2,
        }
      ],
      premiumDiscount: {
        equilibrium,
        premiumZone: { start: equilibrium, end: startPrice * 1.05 },
        discountZone: { start: startPrice * 0.95, end: equilibrium },
        optimalTradeEntry: { start: startPrice * 0.970, end: startPrice * 0.982 },
      },
      flowPulseScore: ticker === 'BTCUSDT' ? 82 : ticker === 'ETHUSDT' ? 41 : 95,
      flowPulseDirection: ticker === 'ETHUSDT' ? 'BEARISH' : 'BULLISH',
      candles,
    };
  }

  public connect() {
    if (this.status === 'connected') return;

    this.status = 'reconnecting';
    this.notifyStatus();
    this.addLog('ws://bybit.futures.com/linear/feedback - Connection requested...');

    setTimeout(() => {
      this.status = 'connected';
      this.latency = 18;
      this.notifyStatus();
      this.addLog('Successfully established persistent Bybit multiplex live frame WebSocket.');
      this.addLog('Subscribed to ticker channels: BTCUSDT@kline.5m, ETHUSDT@kline.5m, SOLUSDT@kline.5m');
      this.addLog('Active ICT execution engines: [StructureShiftEngine, FvgEngine, ObEngine, LiquidityEngine, FlowPulse]');

      // Start tick updates
      this.startTicks();
      this.startLogTicks();
    }, 1200);
  }

  public disconnect() {
    if (this.status === 'disconnected') return;
    
    this.status = 'disconnected';
    this.latency = 0;
    this.notifyStatus();
    this.addLog('WebSocket manually severed. Disconnected from live exchange stream.');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.logIntervalId) {
      clearInterval(this.logIntervalId);
      this.logIntervalId = null;
    }
  }

  private startTicks() {
    if (this.intervalId) clearInterval(this.intervalId);
    
    this.intervalId = setInterval(() => {
      if (this.status !== 'connected') return;

      // Fluctuate latency slightly
      this.latency = Math.max(12, Math.min(65, Math.round(this.latency + (Math.random() - 0.5) * 8)));
      this.notifyStatus();

      // Tick each asset
      (Object.keys(this.states) as AssetTicker[]).forEach((ticker) => {
        this.tickTicker(ticker);
      });
    }, 1500);
  }

  private startLogTicks() {
    if (this.logIntervalId) clearInterval(this.logIntervalId);
    this.logIntervalId = setInterval(() => {
      if (this.status !== 'connected') return;
      const feeds = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
      const feed = feeds[Math.floor(Math.random() * feeds.length)];
      const randomPrice = this.prices[feed as AssetTicker];
      const randomSize = (Math.random() * 12 + 1).toFixed(3);
      const isBuy = Math.random() > 0.48;
      
      const payload = {
        topic: `trade.${feed}`,
        data: [{
          p: randomPrice.toFixed(2),
          v: randomSize,
          s: isBuy ? 'Buy' : 'Sell',
          t: Date.now()
        }]
      };
      
      this.addLog(`Rx Payload: ${JSON.stringify(payload)}`);
    }, 4000);
  }

  private tickTicker(ticker: AssetTicker) {
    const state = this.states[ticker];
    
    // Simulate natural price drift
    const isBullish = state.bias === 'BULLISH';
    const driftFactor = isBullish ? 0.00015 : -0.00012;
    const randomChange = (Math.random() - (isBullish ? 0.45 : 0.55)) * 0.0008; // subtle noise
    const delta = state.price * (driftFactor + randomChange);
    
    const oldPrice = state.price;
    state.price += delta;
    this.prices[ticker] = state.price;

    // Check high/low 24h
    if (state.price > state.high24h) state.high24h = state.price;
    if (state.price < state.low24h) state.low24h = state.price;

    // Tick volume
    state.volume24h += Math.round(Math.random() * 25);
    
    // Update price change percent dynamically
    state.priceChangePercent += delta / oldPrice * 100;

    // Dynamic FlowPulse
    state.flowPulseScore = Math.min(100, Math.max(0, state.flowPulseScore + Math.round((Math.random() - 0.49) * 12)));
    state.flowPulseDirection = state.flowPulseScore > 65 ? 'BULLISH' : state.flowPulseScore < 35 ? 'BEARISH' : 'NEUTRAL';

    // Update current active candle in history (close value of the last bar represents the active live price)
    const candlesLength = state.candles.length;
    if (candlesLength > 0) {
      const activeCandle = state.candles[candlesLength - 1];
      activeCandle.close = state.price;
      activeCandle.high = Math.max(activeCandle.high, state.price);
      activeCandle.low = Math.min(activeCandle.low, state.price);
      activeCandle.volume += Math.round(Math.random() * 2);
    }

    // 1. LIQUIDITY sweep detection
    state.liquidityPools.forEach((pool) => {
      if (!pool.swept) {
        // Calculate dynamic live distance
        pool.distancePct = Math.abs(pool.price - state.price) / state.price * 100;
        
        const priceCrossed = pool.type === 'BSL' 
          ? oldPrice < pool.price && state.price >= pool.price
          : oldPrice > pool.price && state.price <= pool.price;

        if (priceCrossed) {
          pool.swept = true;
          pool.distancePct = 0;
          this.triggerAlert(ticker, 'LIQUIDITY_SWEEP', `Institutional Sweep detected: ${pool.type} liquidity pool wiped at $${pool.price.toLocaleString()} on ${ticker}.`, 'high');
          this.addLog(`[ALERT] Sweep! Ticker ${ticker} cleared ${pool.type} resting orders at $${pool.price.toLocaleString()}.`);
          
          // Trigger a temporary structure shift CHOCH or MSS!
          const newShiftType = pool.type === 'BSL' ? 'CHOCH' : 'MSS';
          state.shifts.unshift({
            type: newShiftType,
            price: state.price,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            confirmed: true
          });
          
          if (state.shifts.length > 5) state.shifts.pop();
        }
      }
    });

    // 2. FVG fill calculation
    state.fvgs.forEach((fvg) => {
      if (fvg.fillPercentage < 100) {
        // Simple logic to fill FVG as current price touches it
        if (state.price >= fvg.low && state.price <= fvg.high) {
          const totalDist = fvg.high - fvg.low;
          const enteredDist = fvg.type === 'BULLISH'
            ? fvg.high - state.price
            : state.price - fvg.low;
          const newFill = Math.min(100, Math.max(fvg.fillPercentage, Math.round((enteredDist / totalDist) * 100)));
          
          if (newFill > fvg.fillPercentage) {
            fvg.fillPercentage = newFill;
            if (fvg.fillPercentage >= 100) {
              fvg.strength = 'WEAK'; // fully filled
              this.addLog(`[FVG Engine] FVG ID ${fvg.id} has been completely filled and liquidated.`);
            }
          }
        }
      }
    });

    // 3. OrderBlock mitigation check
    state.orderBlocks.forEach((ob) => {
      if (!ob.mitigated) {
        const touched = state.price >= ob.bottomPrice && state.price <= ob.topPrice;
        if (touched) {
          ob.mitigated = true;
          this.triggerAlert(ticker, 'LIQUIDITY_SWEEP', `Institutional Order Block mitigated at $${state.price.toLocaleString()} on ${ticker}.`, 'medium');
          this.addLog(`[OB Engine] OB ID ${ob.id} mitigated at $${state.price.toLocaleString()}. Demand consumed.`);
        }
      }
    });

    // Notify index subscribers
    const subs = this.marketCallbacks.get(ticker);
    if (subs) {
      subs.forEach((cb) => cb({ ...state }));
    }
  }

  public getSetupRecommendation(ticker: AssetTicker): TradeRecommendation {
    const state = this.states[ticker];
    const isBtc = ticker === 'BTCUSDT';
    const isEth = ticker === 'ETHUSDT';
    
    // Scoring criteria metrics (Module Setup Validator)
    const msPoints = state.bias === 'BULLISH' ? 22 : state.bias === 'BEARISH' ? 20 : 10;
    const liqPoints = state.liquidityPools.filter(p => p.swept).length > 0 ? 15 : 8;
    const fvgPoints = state.fvgs.some(f => f.fillPercentage > 15 && f.fillPercentage < 100) ? 14 : 7;
    const obPoints = state.orderBlocks.some(o => !o.mitigated) ? 15 : 6;
    
    // Premium/Discount placement metric
    const isDiscount = state.price <= state.premiumDiscount.equilibrium;
    const pdPoints = isDiscount ? 10 : 3;
    
    const volPoints = state.flowPulseScore > 75 || state.flowPulseScore < 25 ? 10 : 6;
    const htfPoints = state.biasConfidence > 80 ? 10 : 7;

    const total = msPoints + liqPoints + fvgPoints + obPoints + pdPoints + volPoints + htfPoints;
    
    let grade: 'A+' | 'A' | 'B' | 'C' | 'REJECT' = 'C';
    if (total >= 95) grade = 'A+';
    else if (total >= 85) grade = 'A';
    else if (total >= 75) grade = 'B';
    else if (total < 75) grade = 'REJECT';

    // Targets
    const multiplier = state.price * 0.005;
    const isLong = state.bias === 'BULLISH';
    
    const entryMin = isLong ? state.price * 0.998 : state.price * 1.001;
    const entryMax = isLong ? state.price * 1.002 : state.price * 0.999;
    const stopLoss = isLong ? state.price * 0.992 : state.price * 1.008;
    const tp1 = isLong ? state.price * 1.006 : state.price * 0.994;
    const tp2 = isLong ? state.price * 1.013 : state.price * 0.987;
    const tp3 = isLong ? state.price * 1.022 : state.price * 0.978;

    const rr = Math.abs(tp1 - state.price) / Math.abs(state.price - stopLoss);

    // Dynamic custom descriptions matching live trends
    const explanation = isLong 
      ? `A highly correlated ICT ${grade} LONG model has drafted on ${ticker}. Recent MSS shifts confirmed on the execution timeline, triggered right after a prominent institutional Sell-Side Liquidity sweep. The price is currently settled deeply inside the discounted zone (below the equilibrium of $${state.premiumDiscount.equilibrium.toLocaleString()}), retesting unmitigated bullish order block demand levels with substantial displacement in FlowPulse indexes.`
      : `An institutional short confirmation model has developed for ${ticker}. Buy-Side resting liquidity pools were extensively swept, shifting character back into bearish structural bias. Price is currently pushing trade entry areas within the critical Premium imbalance grid. Volume-flows confirm strong whale Sell displacement. Highly prudent targets placed immediately ahead of active retail demand triggers.`;

    return {
      ticker,
      direction: isLong ? 'LONG' : 'SHORT',
      entryZone: { start: Math.min(entryMin, entryMax), end: Math.max(entryMin, entryMax) },
      stopLoss,
      tp1,
      tp2,
      tp3,
      riskRewardRatio: isNaN(rr) ? 2.35 : rr + 1.2,
      winProbabilityEstimate: total - 5 + Math.round(Math.random() * 8),
      confidenceScore: total,
      grade,
      scoreCard: {
        marketStructure: msPoints,
        liquidity: liqPoints,
        fvg: fvgPoints,
        orderBlock: obPoints,
        premiumDiscount: pdPoints,
        volume: volPoints,
        htfAlignment: htfPoints,
        total
      },
      explanation,
      timestamp: new Date().toLocaleTimeString(),
    };
  }

  // Event Subscription methods
  public subscribeToMarket(ticker: AssetTicker, callback: MarketCallback): () => void {
    if (!this.marketCallbacks.has(ticker)) {
      this.marketCallbacks.set(ticker, new Set());
    }
    this.marketCallbacks.get(ticker)!.add(callback);
    
    // Initial emit
    callback({ ...this.states[ticker] });

    return () => {
      const subs = this.marketCallbacks.get(ticker);
      if (subs) {
        subs.delete(callback);
      }
    };
  }

  public subscribeToStatus(callback: StatusCallback): () => void {
    this.statusCallbacks.add(callback);
    callback(this.status, this.latency);
    return () => {
      this.statusCallbacks.delete(callback);
    };
  }

  public subscribeToAlerts(callback: AlertCallback): () => void {
    this.alertCallbacks.add(callback);
    return () => {
      this.alertCallbacks.delete(callback);
    };
  }

  public subscribeToLogs(callback: LogCallback): () => void {
    this.logCallbacks.add(callback);
    return () => {
      this.logCallbacks.delete(callback);
    };
  }

  private notifyStatus() {
    this.statusCallbacks.forEach((cb) => cb(this.status, this.latency));
  }

  private triggerAlert(
    ticker: AssetTicker, 
    type: Alert['type'], 
    message: string, 
    severity: Alert['severity']
  ) {
    const alert: Alert = {
      id: `${ticker}-${Date.now()}-${Math.floor(Math.random() * 100)}`,
      ticker,
      type,
      message,
      timestamp: new Date().toLocaleTimeString(),
      severity,
    };
    
    this.alertCallbacks.forEach((cb) => cb(alert));
  }

  private addLog(log: string) {
    const timedLog = `[${new Date().toLocaleTimeString()}] ${log}`;
    this.logCallbacks.forEach((cb) => cb(timedLog));
  }
}

export const wsService = new WebSocketSimulator();
