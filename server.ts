/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

// Initialize Express
const app = express();
const PORT = 3000;

app.use(express.json());

// Bybit autopilot trading logs storage
interface BotLog {
  id: string;
  timestamp: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  message: string;
}

let botLogs: BotLog[] = [
  {
    id: 'log-init',
    timestamp: new Date().toLocaleTimeString(),
    type: 'INFO',
    message: 'Institutional Trading Engine initialized. Ready to execute.'
  }
];

function addBotLog(type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR', message: string) {
  const newLog: BotLog = {
    id: `blog-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    timestamp: new Date().toLocaleTimeString(),
    type,
    message
  };
  botLogs.push(newLog);
  if (botLogs.length > 50) botLogs.shift();
}

// REST Api endpoint block for Bybit configuration
app.get("/api/bybit/config", (req, res) => {
  const apiKey = process.env.BYBIT_API_KEY || "";
  const apiSecret = process.env.BYBIT_API_SECRET || "";
  
  res.json({
    bybit_api_key: apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : "",
    bybit_api_secret_set: !!apiSecret,
    leverage: parseInt(process.env.LEVERAGE || "10", 10),
    risk_per_trade_percent: parseFloat(process.env.RISK_PER_TRADE || "1"),
    max_open_trades: parseInt(process.env.MAX_OPEN_TRADES || "1", 10),
    max_risk_per_trade: parseFloat(process.env.MAX_RISK_PER_TRADE || "2.0"),
    min_signal_score: parseInt(process.env.MIN_SIGNAL_SCORE || "60", 10),
    max_margin_per_trade: parseFloat(process.env.MAX_MARGIN_PER_TRADE || "1.0"),
    max_notional_per_trade: parseFloat(process.env.MAX_NOTIONAL_PER_TRADE || "20.0"),
    is_configured: !!(apiKey && apiSecret)
  });
});

app.get("/api/bybit/logs", (req, res) => {
  res.json(botLogs);
});

app.post("/api/bybit/clear-logs", (req, res) => {
  botLogs = [
    {
      id: `blog-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      type: 'INFO',
      message: 'Bybit autopilot log feed cleared.'
    }
  ];
  res.json({ status: "success" });
});

// REST Api endpoint block for Trade Execution
app.post("/api/bybit/execute", async (req, res) => {
  try {
    const { ticker, direction, price, stopLoss, takeProfit, score } = req.body;
    
    if (!ticker || !direction || !price || !stopLoss) {
      res.status(400).json({ error: "Missing required trading execution parameters" });
      return;
    }

    const leverage = parseInt(process.env.LEVERAGE || "10", 10);
    const riskPercentInput = parseFloat(process.env.RISK_PER_TRADE || "1");
    const maxRiskPercent = parseFloat(process.env.MAX_RISK_PER_TRADE || "2.0");
    const riskPercent = Math.min(riskPercentInput, maxRiskPercent);

    const minSignalScore = parseInt(process.env.MIN_SIGNAL_SCORE || "60", 10);
    const maxMargin = parseFloat(process.env.MAX_MARGIN_PER_TRADE || "1.0");
    const maxNotional = parseFloat(process.env.MAX_NOTIONAL_PER_TRADE || "20.0");

    if (score < minSignalScore) {
      addBotLog("WARNING", `Execution rejected: Signal Score ${score} is below config minimum filter ${minSignalScore}`);
      res.json({ success: false, reason: "Signal score below threshold" });
      return;
    }

    addBotLog("INFO", `Evaluating setup: ${ticker} (${direction}) at $${price.toLocaleString()} with stop loss $${stopLoss.toLocaleString()}`);

    let accountBalance = 10000; // default simulation balance
    let realExecutionSuccess = false;
    let orderId = `sim-ord-${Date.now()}`;
    let txnHash = `sim-tx-${Math.random().toString(36).substring(2, 10)}`;

    const apiKey = process.env.BYBIT_API_KEY || "";
    const apiSecret = process.env.BYBIT_API_SECRET || "";
    const hasKeys = !!(apiKey && apiSecret);

    if (hasKeys) {
      addBotLog("INFO", "Bybit credentials present. Retrieving total asset wallet balance...");
      try {
        const timestamp = Date.now().toString();
        const recvWindow = "5000";
        const queryParams = "accountType=UNIFIED";
        const signature = crypto
          .createHmac("sha256", apiSecret)
          .update(timestamp + apiKey + recvWindow + queryParams)
          .digest("hex");

        const balanceResponse = await fetch(`https://api.bybit.com/v5/account/wallet-balance?${queryParams}`, {
          method: "GET",
          headers: {
            "X-BAPI-API-KEY": apiKey,
            "X-BAPI-SIGN": signature,
            "X-BAPI-TIMESTAMP": timestamp,
            "X-BAPI-RECV-WINDOW": recvWindow,
            "Content-Type": "application/json"
          }
        });

        if (balanceResponse.ok) {
          const balData: any = await balanceResponse.json();
          if (balData.retCode === 0 && balData.result?.list?.[0]?.totalWalletBalance) {
            accountBalance = parseFloat(balData.result.list[0].totalWalletBalance);
            addBotLog("SUCCESS", `Connected! Real USDT Wallet balance retrieved: $${accountBalance.toLocaleString()}`);
          } else {
            addBotLog("WARNING", `Bybit balance query failed: ${balData.retMsg || "Code " + balData.retCode}. Falling back to demo portfolio.`);
          }
        } else {
          addBotLog("WARNING", `Bybit REST endpoint unreachable (HTTP ${balanceResponse.status}). Using sandbox balance.`);
        }
      } catch (err: any) {
        addBotLog("WARNING", `Failed fetching Bybit wallet metrics: ${err.message}. Sandbox balance assigned.`);
      }
    } else {
      addBotLog("INFO", "Simulator active. Demonstration account balance: $10,000 USDT.");
    }

    // POSITION SIZING MATRIX
    // Risk amount in fiat USD
    const riskUsd = accountBalance * (riskPercent / 100);
    // Grid distance percent to invalidity point
    const slDistancePct = Math.abs(price - stopLoss) / price;

    // Base risk matching notional size
    let targetNotional = riskUsd / (slDistancePct || 0.005);
    addBotLog("INFO", `Risk Formula: Allocated Drawdown $${riskUsd.toFixed(2)} (${riskPercent}%), SL SL-Distance ${(slDistancePct * 100).toFixed(2)}%`);

    // Margin constraints (notional / leverage must <= maxMargin)
    const initialMarginRequired = targetNotional / leverage;
    if (initialMarginRequired > maxMargin) {
      const clampedNotional = maxMargin * leverage;
      addBotLog("WARNING", `Margin boundary hit: Projected margin $${initialMarginRequired.toFixed(2)} > allowed limit $${maxMargin.toFixed(2)}. Downgraded position notional from $${targetNotional.toFixed(2)} to $${clampedNotional.toFixed(2)}.`);
      targetNotional = clampedNotional;
    }

    // Notional constraints
    if (targetNotional > maxNotional) {
      addBotLog("WARNING", `Notional ceiling hit: Projected notional $${targetNotional.toFixed(2)} > allowed limit $${maxNotional.toFixed(2)}. Clamping size.`);
      targetNotional = maxNotional;
    }

    // Quantity calculations matching contract specifications
    let quantity = targetNotional / price;
    if (ticker === "BTCUSDT") {
      quantity = Math.round(quantity * 1000) / 1000;
    } else if (ticker === "ETHUSDT") {
      quantity = Math.round(quantity * 100) / 100;
    } else {
      quantity = Math.round(quantity * 10) / 10;
    }

    if (quantity <= 0) {
      addBotLog("ERROR", "Contracts scale calculated to 0 units under constraints. Trade rejected.");
      res.json({ success: false, reason: "Quantity calculated to 0 under constraints" });
      return;
    }

    const calculatedNotional = quantity * price;
    const finalMarginRequired = calculatedNotional / leverage;

    addBotLog("INFO", `Target size locked: ${quantity} units ($${calculatedNotional.toFixed(2)} Notional) using $${finalMarginRequired.toFixed(2)} Margin at ${leverage}x leverage`);

    // BYBIT SERVICE INTEGRATION CALLS
    if (hasKeys) {
      addBotLog("INFO", `Transmitting order payload to real Bybit Linear Desk... Symbol: ${ticker} Side: ${direction}`);
      try {
        // Set leverage API call first
        const setLevTimestamp = Date.now().toString();
        const setLevBody = JSON.stringify({
          category: "linear",
          symbol: ticker,
          buyLeverage: leverage.toString(),
          sellLeverage: leverage.toString()
        });
        const setLevSign = crypto
          .createHmac("sha256", apiSecret)
          .update(setLevTimestamp + apiKey + "5000" + setLevBody)
          .digest("hex");

        await fetch("https://api.bybit.com/v5/position/set-leverage", {
          method: "POST",
          headers: {
            "X-BAPI-API-KEY": apiKey,
            "X-BAPI-SIGN": setLevSign,
            "X-BAPI-TIMESTAMP": setLevTimestamp,
            "X-BAPI-RECV-WINDOW": "5000",
            "Content-Type": "application/json"
          },
          body: setLevBody
        });

        // Place order API call
        const placeTimestamp = Date.now().toString();
        const placeBody = JSON.stringify({
          category: "linear",
          symbol: ticker,
          side: direction === "LONG" ? "Buy" : "Sell",
          orderType: "Market",
          qty: quantity.toString(),
          positionIdx: 0,
          timeInForce: "GTC",
          takeProfit: takeProfit ? (Math.round(takeProfit * 100) / 100).toString() : undefined,
          stopLoss: stopLoss ? (Math.round(stopLoss * 100) / 100).toString() : undefined
        });
        const placeSign = crypto
          .createHmac("sha256", apiSecret)
          .update(placeTimestamp + apiKey + "5000" + placeBody)
          .digest("hex");

        const orderResponse = await fetch("https://api.bybit.com/v5/order/create", {
          method: "POST",
          headers: {
            "X-BAPI-API-KEY": apiKey,
            "X-BAPI-SIGN": placeSign,
            "X-BAPI-TIMESTAMP": placeTimestamp,
            "X-BAPI-RECV-WINDOW": "5000",
            "Content-Type": "application/json"
          },
          body: placeBody
        });

        const orderData: any = await orderResponse.json();
        if (orderResponse.ok && orderData.retCode === 0) {
          realExecutionSuccess = true;
          orderId = orderData.result?.orderId || orderId;
          txnHash = `tx-${orderId.substring(0, 10)}`;
          addBotLog("SUCCESS", `🛡️ [BYBIT LIVE] ORDER EXECUTED! Contracts placed onto matching pool. Order ID: ${orderId}`);
        } else {
          addBotLog("ERROR", `Bybit rejected execution parameters: [${orderData.retCode}] ${orderData.retMsg}`);
        }
      } catch (err: any) {
        addBotLog("ERROR", `Transaction failed on client level: ${err.message}`);
      }
    }

    if (!realExecutionSuccess && hasKeys) {
      addBotLog("WARNING", "Live matching pool order rejected. Defaulting to sandbox record tracker.");
    }

    if (!hasKeys) {
      addBotLog("SUCCESS", `🚀 [SANDBOX] EXECUTION COMPLETED! Simulated positions initialized in ledger at entry price.`);
    }

    res.json({
      success: true,
      executionMode: hasKeys && realExecutionSuccess ? "REAL_BYBIT" : "SANDBOX_SIMULATOR",
      orderId,
      txnHash,
      quantity,
      finalMargin: finalMarginRequired,
      notionalValue: calculatedNotional,
      leverage,
      balance: accountBalance,
      riskSpent: riskUsd,
      timestamp: new Date().toLocaleTimeString()
    });

  } catch (err: any) {
    console.error("Bybit Trade Execution API Error:", err);
    addBotLog("ERROR", `Bot Executor crash: ${err.message}`);
    res.status(500).json({ error: err.message || "Failed trade execution protocol." });
  }
});

// Initialize Gemini SDK lazily to prevent crash on startup if key is missing
let aiClient: GoogleGenAI | null = null;
function getGenAI() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY environment variable is not defined. AI Copilot will use placeholder responses.");
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// API endpoint for AI Copilot
app.post("/api/copilot", async (req, res) => {
  try {
    const { message, history = [], marketState, ticker, lastRecommendation } = req.body;
    
    if (!message) {
      res.status(400).json({ error: "Message content is required" });
      return;
    }

    const ai = getGenAI();
    if (!ai) {
      // Return beautiful mock simulation response if API key is not yet set
      const tickerName = ticker || 'selected ticker';
      const priceStr = marketState?.price ? `$${marketState.price.toLocaleString()}` : 'the current market price';
      const promptText = message.toLowerCase();
      let responseText = `[AI Copilot - Offline Simulation Mode]\n\n`;

      if (promptText.includes("why") || promptText.includes("setup")) {
        responseText += `The current Setup for ${tickerName} is graded according to our 100-point ICT scorecard:\n`;
        if (marketState) {
          responseText += `- Market Structure (${marketState.bias} Bias): ${marketState.biasConfidence}/25 pts\n`;
          responseText += `- Premium/Discount Equilibrium: Inside the ${marketState.price > marketState.premiumDiscount?.equilibrium ? 'Premium' : 'Discount'} zone (OTE at $${marketState.premiumDiscount?.optimalTradeEntry?.start.toLocaleString()} - $${marketState.premiumDiscount?.optimalTradeEntry?.end.toLocaleString()})\n`;
          responseText += `- FlowPulse Spike Index: ${marketState.flowPulseScore}/100 volume flow\n\n`;
          responseText += `To unlock native server-side Gemini 3.5 precision, please configure your **GEMINI_API_KEY** secret in the **Settings > Secrets** panel!`;
        } else {
          responseText += `No live state found. Please configure your GEMINI_API_KEY in the AI Studio UI settings under Secrets to query real-time analysis!`;
        }
      } else if (promptText.includes("liquidity") || promptText.includes("sweep")) {
        responseText += `Based on liquid order flow levels for ${tickerName}:\n`;
        if (marketState?.liquidityPools) {
          const unswept = marketState.liquidityPools.filter((p: any) => !p.swept);
          unswept.forEach((p: any) => {
            responseText += `- ${p.type} detected at $${p.price.toLocaleString()} (${p.distancePct.toFixed(2)}% distance, ${p.strength}-star pool)\n`;
          });
        }
        responseText += `\nPlease add your GEMINI_API_KEY in Secrets for live institutional explanations!`;
      } else {
        responseText += `I am active and monitoring the live Bybit Feed for ${tickerName}. Currently trading at ${priceStr}.\n\n`;
        responseText += `Since you are running in the AI Studio sandbox, configure your **GEMINI_API_KEY** under **Settings > Secrets** to enable the fully customized Gemini 3.5 Flash trading brain. Once defined, I will explain structure shifts, order blocks, FVG fill-ratios, and premium-discount retracements exactly live!`;
      }

      res.json({ text: responseText });
      return;
    }

    // Construct highly specialized ICT trading system prompt
    const systemInstruction = `You are "TradeBrain ICT", a professional-grade quantitative trading consultant, Inner Circle Trader (ICT) mentor, and automated decision-support coach.
Your task is to analyze the market state provided and help the manual trader formulate strategic execution protocols.

--- MARKET ENVIRONMENT STATE ---
Ticker: ${ticker || 'BTCUSDT'}
Live Price: $${marketState?.price?.toLocaleString() || 'N/A'}
Market Bias: ${marketState?.bias || 'NEUTRAL'} (${marketState?.biasConfidence || 0}% bias confidence)
FlowPulse Momentum Score: ${marketState?.flowPulseScore || 50}/100 [Direction: ${marketState?.flowPulseDirection || 'NEUTRAL'}]

Active Fair Value Gaps (FVGs):
${marketState?.fvgs?.map((f: any) => `- FVG ID ${f.id}: ${f.type} FVG | High: $${f.high.toLocaleString()} | Low: $${f.low.toLocaleString()} | Size: ${f.size.toFixed(2)}% | Strength: ${f.strength} | Fill-percent: ${f.fillPercentage}%`).join('\n') || 'None'}

Active Institutional Order Blocks (OBs):
${marketState?.orderBlocks?.map((o: any) => `- OB ID ${o.id}: ${o.type} OB | Zone: $${o.bottomPrice.toLocaleString()} - $${o.topPrice.toLocaleString()} | Mitigated: ${o.mitigated ? 'Yes' : 'No'} | Displacement: ${o.displacement.toFixed(2)}%`).join('\n') || 'None'}

Unswept Liquidity Pools:
${marketState?.liquidityPools?.filter((l: any) => !l.swept).map((l: any) => `- Pool ${l.id}: ${l.type} | Level: $${l.price.toLocaleString()} | Quality: ${l.strength}-Star | Distance: ${l.distancePct.toFixed(2)}%`).join('\n') || 'None'}

Premium vs. Discount Zones:
- Equilibrium Midpoint: $${marketState?.premiumDiscount?.equilibrium?.toLocaleString() || 'N/A'}
- Optimal Trade Entry (OTE) Retracement Grid: $${marketState?.premiumDiscount?.optimalTradeEntry?.start?.toLocaleString() || 'N/A'} - $${marketState?.premiumDiscount?.optimalTradeEntry?.end?.toLocaleString() || 'N/A'}

Active Trade Recommendation:
${lastRecommendation ? `Direction: ${lastRecommendation.direction} | Grade: ${lastRecommendation.grade} (Score: ${lastRecommendation.scoreCard?.total}/100)\n- Entry Zone: $${lastRecommendation.entryZone?.start?.toLocaleString()} - $${lastRecommendation.entryZone?.end?.toLocaleString()}\n- Stop Loss: $${lastRecommendation.stopLoss?.toLocaleString()}\n- TP1/TP2/TP3: $${lastRecommendation.tp1?.toLocaleString()} / $${lastRecommendation.tp2?.toLocaleString()} / $${lastRecommendation.tp3?.toLocaleString()}\n- Risk Reward: ${lastRecommendation.riskRewardRatio?.toFixed(2)}:1` : 'No active recommendation available.'}

--- INSTRUCTIONS ---
- Talk like a seasoned Institutional Trading Desk Lead. Be authoritative, risk-conscious, and precise.
- Use explicit price points and distances given in the state above. Do not hallucinate price levels which are not listed.
- Ground answer in ICT Mechanics:
  1. Draw On Liquidity (DOL): Where is the market likely magnetized? (e.g., BTC drawing on Swept BSL or local unmitigated OB).
  2. Displacement & Reversal shifts: Market Structure Shifts (MSS) must be accompanied by strong displacement candles.
  3. Premium/Discount rules: Do not support long entries unless current price is resting inside the Discount zone (below Equilibrium) or retesting an OTE zone.
- Keep output nicely formatted using Markdown, clear bullet points, and clean syntax tags.
- Use simple and humble labels. No unrequested sci-fi terms, or status codes.
- Do not mention file paths, codebase internals, or private technical details (like 'process.env').
`;

    // Package contents appropriately with history
    const contents: any[] = [];
    
    // Add history
    for (const h of history) {
      if (h.sender === 'user') {
        contents.push({ role: 'user', parts: [{ text: h.text }] });
      } else {
        contents.push({ role: 'model', parts: [{ text: h.text }] });
      }
    }
    
    // Add current user prompt
    contents.push({ role: 'user', parts: [{ text: message }] });

    // Call Gemini using the official @google/genai SDK
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const text = response.text || "I was unable to formulate an ICT strategy for this state. Please ensure your charts are fully synchronized and try again.";
    res.json({ text });
    
  } catch (error: any) {
    console.error("AI Copilot API Error:", error);
    res.status(500).json({ error: error.message || "Internal server error occurred while invoking Gemini API" });
  }
});

// Configure Vite middleware in development or serve static build files in production
const startServer = async () => {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    
    app.use(vite.middlewares);
    
    // Fallback index.html loading for SPA routing
    app.get("*", async (req, res, next) => {
      try {
        const url = req.originalUrl;
        const indexHtml = path.resolve(process.cwd(), "index.html");
        res.sendFile(indexHtml);
      } catch (e) {
        next(e);
      }
    });
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`TradeBrain ICT server active at http://0.0.0.0:${PORT}`);
  });
};

startServer().catch((e) => {
  console.error("Failed to start server:", e);
});
