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

dotenv.config();

// Initialize Express
const app = express();
const PORT = 3000;

app.use(express.json());

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
