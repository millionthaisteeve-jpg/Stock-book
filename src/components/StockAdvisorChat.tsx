import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, ShieldCheck, RefreshCw } from 'lucide-react';
import { Transaction, ChatMessage } from '../types';

interface StockAdvisorChatProps {
  transactions: Transaction[];
  currentPrices: { [ticker: string]: number };
  baseCurrency: 'KRW' | 'USD';
  exchangeRate: number;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  messages: ChatMessage[];
  onAddMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  onClearMessages: () => void;
}

export default function StockAdvisorChat({
  transactions,
  currentPrices,
  baseCurrency,
  exchangeRate,
  apiKey,
  onApiKeyChange,
  messages,
  onAddMessage,
  onClearMessages,
}: StockAdvisorChatProps) {
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEditingKey, setIsEditingKey] = useState(!apiKey);
  const [tempApiKey, setTempApiKey] = useState(apiKey);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // ==========================================
  // [로직] 1. 포트폴리오 스냅샷 생성 (기준 화폐에 맞춰 동적 환산)
  // ==========================================
  const generatePortfolioSnapshot = (): string => {
    if (transactions.length === 0) {
      return "현재 등록된 매수 포트폴리오 데이터가 없습니다. 빈 상태입니다.";
    }

    const stockMap: {
      [ticker: string]: {
        ticker: string;
        sector: string;
        totalQuantity: number;
        totalCostInBase: number;
        originalCurrency: 'KRW' | 'USD';
      };
    } = {};

    // 1. 거래 내역 취합 및 기준 화폐 환산
    transactions.forEach((tx) => {
      if (!stockMap[tx.ticker]) {
        stockMap[tx.ticker] = {
          ticker: tx.ticker,
          sector: tx.sector,
          totalQuantity: 0,
          totalCostInBase: 0,
          originalCurrency: tx.currency,
        };
      }
      stockMap[tx.ticker].totalQuantity += tx.quantity;
      
      let costInBase = tx.price * tx.quantity;
      if (tx.currency === 'USD' && baseCurrency === 'KRW') {
        costInBase = (tx.price * exchangeRate) * tx.quantity;
      } else if (tx.currency === 'KRW' && baseCurrency === 'USD') {
        costInBase = (tx.price / exchangeRate) * tx.quantity;
      }
      
      stockMap[tx.ticker].totalCostInBase += costInBase;
    });

    const portfolioItems = Object.values(stockMap).map((stock) => {
      const averagePriceInBase = stock.totalQuantity > 0 ? stock.totalCostInBase / stock.totalQuantity : 0;
      
      let storedCurrentPrice = currentPrices[stock.ticker];
      if (storedCurrentPrice === undefined) {
        const originalCost = transactions
          .filter(t => t.ticker === stock.ticker)
          .reduce((sum, t) => sum + (t.price * t.quantity), 0);
        storedCurrentPrice = stock.totalQuantity > 0 ? originalCost / stock.totalQuantity : 0;
      }

      let currentPriceInBase = storedCurrentPrice;
      if (stock.originalCurrency === 'USD' && baseCurrency === 'KRW') {
        currentPriceInBase = storedCurrentPrice * exchangeRate;
      } else if (stock.originalCurrency === 'KRW' && baseCurrency === 'USD') {
        currentPriceInBase = storedCurrentPrice / exchangeRate;
      }

      const currentValue = stock.totalQuantity * currentPriceInBase;
      const gainOrLoss = currentValue - stock.totalCostInBase;
      const returnRate = stock.totalCostInBase > 0 ? (gainOrLoss / stock.totalCostInBase) * 100 : 0;

      return {
        ticker: stock.ticker,
        sector: stock.sector,
        totalQuantity: stock.totalQuantity,
        averagePrice: averagePriceInBase,
        totalCost: stock.totalCostInBase,
        currentPrice: currentPriceInBase,
        currentValue,
        gainOrLoss,
        returnRate
      };
    });

    const totalInvestment = portfolioItems.reduce((sum, item) => sum + item.totalCost, 0);
    const totalEvaluation = portfolioItems.reduce((sum, item) => sum + item.currentValue, 0);
    const overallReturnRate = totalInvestment > 0 ? ((totalEvaluation - totalInvestment) / totalInvestment) * 100 : 0;

    // 통화 기호 설정
    const curSymbol = baseCurrency === 'KRW' ? '₩' : '$';

    // 섹터 요약
    const sectors: { [sector: string]: number } = {};
    portfolioItems.forEach(item => {
      sectors[item.sector] = (sectors[item.sector] || 0) + item.totalCost;
    });
    const sectorSnapshot = Object.entries(sectors)
      .map(([sec, cost]) => `- ${sec}: ${((cost / totalInvestment) * 100).toFixed(1)}% (투자금 ${curSymbol}${cost.toLocaleString(undefined, { maximumFractionDigits: 1 })})`)
      .join('\n');

    // 개별 자산 목록
    const itemsSnapshot = portfolioItems
      .map(item => `* [${item.ticker}] (섹터: ${item.sector}) - 보유량 ${item.totalQuantity}주 / 환산평단 ${curSymbol}${item.averagePrice.toLocaleString(undefined, { maximumFractionDigits: 1 })} / 환산현재가 ${curSymbol}${item.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 1 })} / 총투자액 ${curSymbol}${item.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} / 수익률 ${item.returnRate.toFixed(2)}%`)
      .join('\n');

    return `
[사용자의 주식 포트폴리오 실시간 현황 스냅샷]
- 글로벌 기준 통화: ${baseCurrency} (적용 환율: 1 USD = ₩${exchangeRate})
- 총 투자 원금: ${curSymbol}${totalInvestment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
- 현재 평가 자산: ${curSymbol}${totalEvaluation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
- 누적 평가 손익: ${curSymbol}${(totalEvaluation - totalInvestment).toLocaleString(undefined, { maximumFractionDigits: 0 })} (수익률: ${overallReturnRate.toFixed(2)}%)

[섹터 구성비]
${sectorSnapshot}

[상세 자산 목록]
${itemsSnapshot}
    `.trim();
  };

  const handleSaveApiKey = () => {
    if (tempApiKey.trim()) {
      onApiKeyChange(tempApiKey.trim());
      setIsEditingKey(false);
    }
  };

  // ==========================================
  // [로직] 2. Gemini 2.5 API 멀티턴 연동 호출
  // ==========================================
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputMessage;
    if (!textToSend.trim()) return;

    if (!apiKey) {
      alert("먼저 구글 Gemini API Key를 우측 상단에 입력하여 등록해주세요.");
      setIsEditingKey(true);
      return;
    }

    // 사용자 메시지 추가
    onAddMessage({
      role: 'user',
      content: textToSend
    });
    
    if (!customPrompt) setInputMessage('');
    setIsLoading(true);

    try {
      const portfolioSnapshot = generatePortfolioSnapshot();

      // [시스템 instruction 지침 정의]
      const systemInstructionText = `
너는 세계 최고 수준의 헤지펀드 매니저 출신의 냉철하고 전문적인 주식 포트폴리오 자문가이다.
사용자의 자산 가계부 데이터를 바탕으로 질문에 대한 날카로운 피드백과 조언을 제공해야 한다.
다음 자문 지침을 반드시 철저하게 고수해라:
1. 한국어로 대화하고, 전문적이고 차분하면서도 엄격하며 확신에 찬 어조를 유지할 것.
2. 특정 섹터에 50% 이상 집중되어 있으면 '자산 쏠림 리스크'를 지적하고 리밸런싱 아이디어를 제시할 것.
3. 사용자가 감정적인 충동 거래를 암시하거나 단기 대박을 기대하면 금융 팩트와 논리로 차갑게 경고할 것.
4. 모든 조언은 사용하기 쉬운 Markdown 서식(글머리, 굵게, 인용구, 소제목 등)으로 깔끔하게 줄바꿈하여 가독성 있게 표기할 것.

현재 사용자의 실시간 포트폴리오 스냅샷 데이터는 다음과 같다:
${portfolioSnapshot}
      `.trim();

      // 멀티턴 대화 목록 구축 (contents 배열)
      const contentsArray: any[] = [];
      
      // contents 배열에는 순수하게 대화 히스토리만 적립 (최근 8개 턴으로 제한하여 토큰 세이브)
      const messageHistory = messages.slice(-8);
      
      messageHistory.forEach((msg) => {
        contentsArray.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        });
      });

      // 현재 사용자가 보낸 질문 추가
      contentsArray.push({
        role: 'user',
        parts: [{ text: textToSend }]
      });

      // 공식 API 규격에 맞춰 systemInstruction을 JSON 루트 레벨에 정합하게 팩킹하여 fetch 전송
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: contentsArray,
          systemInstruction: {
            parts: [{ text: systemInstructionText }]
          }
        })
      });

      const data = await response.json();
      
      if (data.candidates && data.candidates[0].content.parts[0].text) {
        onAddMessage({
          role: 'model',
          content: data.candidates[0].content.parts[0].text
        });
      } else {
        throw new Error(data.error?.message || "Gemini 응답 구조가 부적합합니다.");
      }

    } catch (error: any) {
      console.error("Gemini API Error:", error);
      onAddMessage({
        role: 'model',
        content: `❌ **API 호출에 실패했습니다.**\n\n내용: ${error.message || '네트워크 통신 오류'}\n\n*입력하신 Gemini API 키가 정상인지, 무료 쿼터 제한이 끝났는지 확인해 주시기 바랍니다.*`
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 포트폴리오 원클릭 분석 리포트 트리거
  const handleQuickDiagnose = () => {
    if (transactions.length === 0) {
      alert("포트폴리오 분석을 위해 최소 1개 이상의 주식 자산을 등록해 주세요.");
      return;
    }
    handleSendMessage("현재 나의 다중 통화 환산 자산 구성 및 분산 다각화 밸런스에 대해 자산운용사 시각에서 냉정하게 종합 리포트를 작성해줘.");
  };

  // 마크다운 파싱 헬퍼 함수
  const parseMarkdown = (text: string) => {
    return text.split('\n').map((line, idx) => {
      if (line.startsWith('### ')) {
        return <h4 key={idx} className="text-xs font-bold text-cyan-600 dark:text-cyan-400 mt-3 mb-1.5 font-sans">{line.slice(4)}</h4>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={idx} className="text-sm font-bold text-cyan-700 dark:text-cyan-300 mt-4 mb-2 font-sans border-b border-slate-200 dark:border-slate-800 pb-1">{line.slice(3)}</h3>;
      }
      if (line.startsWith('* ') || line.startsWith('- ')) {
        return (
          <li key={idx} className="ml-4 list-disc text-3xs text-slate-600 dark:text-slate-350 my-0.5 leading-relaxed">
            {renderBoldText(line.slice(2))}
          </li>
        );
      }
      if (line.startsWith('> ')) {
        return (
          <blockquote key={idx} className="border-l-3 border-cyan-500 bg-slate-100 dark:bg-slate-950/60 px-3 py-2 my-2 text-3xs text-slate-500 dark:text-slate-400 italic rounded-r-md">
            {renderBoldText(line.slice(2))}
          </blockquote>
        );
      }
      return (
        <p key={idx} className="text-3xs text-slate-600 dark:text-slate-300 my-1 leading-relaxed min-h-[0.8rem]">
          {renderBoldText(line)}
        </p>
      );
    });
  };

  const renderBoldText = (text: string) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="text-cyan-600 dark:text-cyan-400 font-extrabold">{part}</strong> : part);
  };

  return (
    <div className="glass-card flex flex-col h-[670px] relative overflow-hidden">
      {/* 챗존 헤더 */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-500 dark:text-cyan-400 animate-pulse" />
            <h3 className="text-xs lg:text-sm font-extrabold text-slate-800 dark:text-slate-100 font-sans tracking-wide">Gemini AI 투자 전문 자문관</h3>
          </div>
          
          <button
            onClick={() => setIsEditingKey(!isEditingKey)}
            className={`flex items-center gap-1 text-4xs px-2.5 py-1.5 rounded-lg border font-bold transition-all ${
              apiKey 
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 animate-pulse'
            }`}
          >
            {apiKey ? 'API Key 등록완료' : 'API Key 입력요망'}
          </button>
        </div>

        {/* API Key 입력 폼 */}
        {isEditingKey && (
          <div className="p-3 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between text-4xs text-slate-500 font-semibold">
              <span>Google Gemini API Key 설정</span>
              <a 
                href="https://aistudio.google.com/" 
                target="_blank" 
                rel="noreferrer"
                className="text-cyan-500 dark:text-cyan-400 hover:underline"
              >
                무료 키 발급 탭 이동 →
              </a>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder="AI Studio에서 복사한 API Key 기입"
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-1.5 text-xs outline-none"
              />
              <button
                onClick={handleSaveApiKey}
                className="btn-primary py-1 px-3.5 text-xs font-bold shrink-0"
              >
                저장
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 채팅 목록 피드 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30 dark:bg-slate-950/20">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="p-4 bg-cyan-500/10 dark:bg-cyan-950/20 rounded-full border border-cyan-500/10">
              <Sparkles className="w-7 h-7 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div className="space-y-1">
              <h4 className="text-2xs font-extrabold text-slate-700 dark:text-slate-200">인공지능 자문관 대기 상태</h4>
              <p className="text-3xs text-slate-500 max-w-[240px] leading-normal font-medium">
                원화 및 달러로 환산된 실시간 포트폴리오 쏠림 현상과 분산 투자 전략을 즉시 도출해 드립니다.
              </p>
            </div>
            <button
              onClick={handleQuickDiagnose}
              disabled={isLoading}
              className="btn-primary text-xs py-2 px-5 font-bold shadow flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              내 포트폴리오 원클릭 종합 분석
            </button>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-cyan-500 to-indigo-600 text-white rounded-tr-none shadow-md'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-250 rounded-tl-none shadow'
                }`}
              >
                {msg.role === 'model' ? (
                  <div className="space-y-1">{parseMarkdown(msg.content)}</div>
                ) : (
                  <p className="text-3xs leading-relaxed whitespace-pre-wrap font-sans">{msg.content}</p>
                )}
                
                <div className={`text-4xs mt-2 text-right ${
                  msg.role === 'user' ? 'text-cyan-100/80' : 'text-slate-400 dark:text-slate-500 font-medium'
                }`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))
        )}

        {/* AI 로딩 점멸 */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-none p-4 shadow">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-500 animate-spin" />
                <span className="text-4xs text-cyan-500 font-extrabold uppercase tracking-wider">포트폴리오 스냅샷 추론 및 자문서 작성 중...</span>
              </div>
              <div className="dot-typing px-1 py-1">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력 패널 구역 */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-2">
        <div className="flex items-center justify-between text-4xs text-slate-400 dark:text-slate-500 font-bold px-1 select-none">
          <span>* 매 질문마다 스위칭된 기준통화의 실시간 스냅샷이 제공됩니다.</span>
          {messages.length > 0 && (
            <button 
              onClick={onClearMessages}
              className="text-rose-500 dark:text-rose-400 hover:text-rose-600 flex items-center gap-0.5 transition-colors"
            >
              <RefreshCw className="w-2.5 h-2.5" /> 대화 리셋
            </button>
          )}
        </div>
        
        <div className="flex gap-2">
          {/* 포트폴리오 바로진단 */}
          <button
            onClick={handleQuickDiagnose}
            disabled={isLoading || transactions.length === 0}
            className="btn-secondary px-3 shrink-0 flex items-center justify-center text-cyan-500 dark:text-cyan-400 bg-white dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="포트폴리오 자문서 즉시 생성"
          >
            <ShieldCheck className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isLoading) handleSendMessage();
            }}
            placeholder={
              apiKey 
                ? "포트폴리오 비중 리밸런싱 방향성을 질문해보세요..." 
                : "상단에 API 키를 등록해야 분석 기능이 활성화됩니다."
            }
            disabled={isLoading || !apiKey}
            className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-xl px-4 py-2 text-3xs outline-none focus:border-cyan-500 placeholder:text-slate-400 dark:placeholder:text-slate-650 disabled:opacity-50"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={isLoading || !apiKey || !inputMessage.trim()}
            className="btn-primary px-4 py-2 flex items-center justify-center shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
