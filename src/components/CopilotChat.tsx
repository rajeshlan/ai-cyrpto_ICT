/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { AssetTicker, CopilotMessage, MarketState, TradeRecommendation } from '../types';
import { MessageSquareCode, Send, Sparkles, User, BrainCircuit, RefreshCw } from 'lucide-react';

interface CopilotChatProps {
  selectedTicker: AssetTicker;
  marketState: MarketState | null;
  lastRecommendation: TradeRecommendation | null;
}

export default function CopilotChat({ 
  selectedTicker, 
  marketState, 
  lastRecommendation 
}: CopilotChatProps) {
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Hello! I am **TradeBrain AI**, your dedicated ICT Quantitative Trading Copilot.\n\nI have complete access to our real-time market structure shifting engines, unmitigated order blocks, FVG fill percentages, and premium/discount brackets.\n\nHow can I help you refine your execution checklist today?`,
      timestamp: new Date().toLocaleTimeString(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Quick prompt presets
  const quickPrompts = [
    { label: "Why is this setup active?", text: "Explain why the current trade setup exists and break down the scorecard metrics." },
    { label: "Show nearest liquidity", text: "Where are the nearest resting buy-side or sell-side liquidity pools on this chart?" },
    { label: "Explain market bias", text: "What is our current market structure shift bias, and which anchor timeline supports it?" },
    { label: "What invalidates this trade?", text: "Under what conditions should we manually abort or invalidate this current trade model?" }
  ];

  // Helper to format assistant messages with bold text and linebreaks beautifully
  const formatMessageText = (text: string) => {
    return text.split('\n').map((line, i) => {
      // Handle list items
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const itemText = line.trim().substring(2);
        return (
          <li key={i} className="ml-4 list-disc text-gray-200 pl-1 mt-1 text-xs font-sans leading-relaxed">
            {parseInlineFormatting(itemText)}
          </li>
        );
      }
      
      // Handle standard line
      return (
        <p key={i} className="mt-1.5 text-xs font-sans text-gray-300 leading-relaxed break-words">
          {parseInlineFormatting(line)}
        </p>
      );
    });
  };

  const parseInlineFormatting = (lineText: string) => {
    // Regex simple token parser for **bold** text
    const parts = lineText.split(/(\*\*.*?\*\*)/);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="text-[#3b82f6] font-bold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    // 1. Add user message
    const userMsg: CopilotMessage = {
      id: `m-${Date.now()}-u`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      // 2. Transmit payload to server
      const response = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: messages.slice(-10), // Pass last 10 messages for conversational memory
          marketState,
          ticker: selectedTicker,
          lastRecommendation,
        }),
      });

      if (!response.ok) {
        throw new Error('Server returned an unstable response status');
      }

      const data = await response.json();
      
      // 3. Add AI model reply
      const assistantMsg: CopilotMessage = {
        id: `m-${Date.now()}-a`,
        sender: 'assistant',
        text: data.text || "I was unable to retrieve a response from the database. Please verify your GEMINI_API_KEY connection.",
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages(prev => [...prev, assistantMsg]);

    } catch (err: any) {
      console.error(err);
      const errMessage: CopilotMessage = {
        id: `m-${Date.now()}-err`,
        sender: 'assistant',
        text: `⚡ **Operational Error**: I could not contact the server model. Ensure that the node container is active and that your **GEMINI_API_KEY** is loaded in the AI Studio **Settings > Secrets** panel.`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages(prev => [...prev, errMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#0b0f19] border border-[#1b253b] rounded-lg p-5 h-full flex flex-col justify-between shadow-xl shadow-black/35 font-sans">
      
      {/* Target header */}
      <div>
        <div className="flex justify-between items-center border-b border-[#1b253b] pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <BrainCircuit className="w-5 h-5 text-blue-400" />
            <h2 className="text-sm font-semibold tracking-wide text-gray-200">AI COPILOT TERMINAL</h2>
          </div>
          
          <div className="flex items-center space-x-1 font-mono text-[9px] text-[#5c6f96]">
            <span>ENGINE:</span>
            <span className="text-emerald-400 font-bold bg-[#10b981]/10 px-1.5 py-0.5 rounded">GEMINI 3.5 FLASH</span>
          </div>
        </div>
      </div>

      {/* Message logs area */}
      <div className="flex-grow flex flex-col justify-between overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1.5 scrollbar-thin scrollbar-thumb-gray-800 min-h-[160px] max-h-[360px]">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex space-x-2.5 ${isUser ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}
              >
                {/* Avatar Icon */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border ${
                  isUser 
                    ? 'bg-blue-600/10 border-blue-500/20 text-[#3b82f6]' 
                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                }`}>
                  {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                </div>

                {/* Bubble Body */}
                <div className={`p-3 max-w-[85%] rounded-xl text-xs ${
                  isUser 
                    ? 'bg-gradient-to-r from-blue-900/40 to-blue-950/50 border border-blue-500/15 text-gray-100 rounded-tr-none' 
                    : 'bg-[#0f1526]/70 border border-[#1b253b]/80 text-gray-200 rounded-tl-none shadow-md'
                }`}>
                  <div className="flex justify-between items-center mb-1 text-[9px] text-gray-500 font-mono">
                    <span className="font-semibold text-[#5c6f96]">
                      {isUser ? 'MANUAL TRADER' : 'COGNITIVE CORE'}
                    </span>
                    <span>{msg.timestamp}</span>
                  </div>
                  <div>
                    {formatMessageText(msg.text)}
                  </div>
                </div>
              </div>
            );
          })}
          
          {/* Loading status */}
          {isLoading && (
            <div className="flex space-x-2.5">
              <div className="w-7 h-7 rounded-full bg-[#1e293b] border border-blue-500/10 flex items-center justify-center shrink-0">
                <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
              </div>
              <div className="p-3 rounded-xl rounded-tl-none bg-[#0f1526]/40 border border-[#1b253b]/40 text-xs font-mono text-gray-500 animate-pulse flex items-center">
                <span>RETRACING DISPLACEMENT CURVES... GENERATING ICT BLUEPRINT...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick click presets panel */}
        <div className="my-4">
          <span className="text-[9px] uppercase tracking-wider font-semibold text-gray-600 font-mono block mb-1.5">
            Suggested Context Grunts
          </span>
          <div className="flex flex-wrap gap-1.5">
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(p.text)}
                disabled={isLoading}
                className="text-[10px] font-sans px-2.5 py-1 text-gray-300 bg-[#0f1526]/80 hover:bg-[#121c33] border border-[#1b253b] rounded-md cursor-pointer hover:border-[#3b82f6]/40 hover:text-white transition-all disabled:opacity-50"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input box */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputText);
          }}
          className="flex space-x-2 border-t border-[#1b253b] pt-3.5"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isLoading}
            placeholder={`Ask about ${selectedTicker.replace("USDT", "")} market order flow bias...`}
            className="flex-1 bg-[#070a12] border border-[#1b253b] hover:border-[#1b253b]/80 focus:border-blue-500 text-gray-200 text-xs px-3.5 py-2.5 rounded-lg outline-none font-sans disabled:opacity-50 transition-all font-medium"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="bg-blue-600 hover:bg-blue-500 font-bold p-2.5 px-3.5 rounded-lg outline-none text-white cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4 shrink-0" />
          </button>
        </form>
      </div>

    </div>
  );
}
