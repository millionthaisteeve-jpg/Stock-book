import { useState, useEffect } from 'react';
import { TrendingUp, CheckCircle, RefreshCw, BarChart2, DollarSign, Download, Upload, Sun, Moon, Settings } from 'lucide-react';
import { Transaction, ChatMessage } from './types';
import StockForm from './components/StockForm';
import PortfolioTable from './components/PortfolioTable';
import StockAdvisorChat from './components/StockAdvisorChat';

// 초기 데모/모크 거래 내역 (하이브리드 다중 통화 지원)
const INITIAL_DEMO_TRANSACTIONS: Transaction[] = [
  { id: 'demo-1', ticker: 'APPLE', sector: '테크 / 빅테크', purchaseDate: '2026-05-10', price: 178, quantity: 8, currency: 'USD' },
  { id: 'demo-2', ticker: '삼성전자', sector: '반도체', purchaseDate: '2026-05-12', price: 71200, quantity: 30, currency: 'KRW' },
  { id: 'demo-3', ticker: 'SK하이닉스', sector: '반도체', purchaseDate: '2026-05-18', price: 168000, quantity: 15, currency: 'KRW' },
  { id: 'demo-4', ticker: '현대차', sector: '자동차 / 2차전지', purchaseDate: '2026-05-20', price: 242000, quantity: 10, currency: 'KRW' },
  { id: 'demo-5', ticker: 'MICROSOFT', sector: '테크 / 빅테크', purchaseDate: '2026-05-22', price: 420, quantity: 5, currency: 'USD' }
];

// 종목별 데모 가상 현재가 (각 종목의 최초 거래 통화 기준 절대값 저장)
const INITIAL_DEMO_PRICES = {
  'APPLE': 186,
  '삼성전자': 69800,
  'SK하이닉스': 182500,
  '현대차': 255000,
  'MICROSOFT': 435
};

export default function App() {
  // 1. 매수 거래 목록 상태 관리
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('stock_transactions');
    return saved ? JSON.parse(saved) : INITIAL_DEMO_TRANSACTIONS;
  });

  // 2. 종목별 현재가 상태 관리 (절대값 저장)
  const [currentPrices, setCurrentPrices] = useState<{ [ticker: string]: number }>(() => {
    const saved = localStorage.getItem('stock_current_prices');
    return saved ? JSON.parse(saved) : INITIAL_DEMO_PRICES;
  });

  // 3. 글로벌 기준 통화 상태 ('KRW' | 'USD')
  const [baseCurrency, setBaseCurrency] = useState<'KRW' | 'USD'>(() => {
    return (localStorage.getItem('stock_base_currency') as 'KRW' | 'USD') || 'KRW';
  });

  // 4. 적용 환율 상태 (1 USD 당 KRW 원화 가치)
  const [exchangeRate, setExchangeRate] = useState<number>(() => {
    const saved = localStorage.getItem('stock_exchange_rate');
    return saved ? Number(saved) : 1380;
  });

  // 5. 환율 조정 패널 토글 상태
  const [showRateModal, setShowRateModal] = useState(false);
  const [tempRate, setTempRate] = useState(exchangeRate.toString());

  // 6. 테마 상태 관리 ('dark' | 'light')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('stock_theme') as 'dark' | 'light') || 'dark';
  });

  // 7. Gemini API Key 상태
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('gemini_api_key') || '';
  });

  // 8. AI 챗 대화 기록 상태
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('chat_messages');
    return saved ? JSON.parse(saved) : [];
  });

  // ==========================================
  // [영속화 및 효과] 로컬스토리지 및 테마 제어
  // ==========================================
  useEffect(() => {
    localStorage.setItem('stock_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('stock_current_prices', JSON.stringify(currentPrices));
  }, [currentPrices]);

  useEffect(() => {
    localStorage.setItem('stock_base_currency', baseCurrency);
  }, [baseCurrency]);

  useEffect(() => {
    localStorage.setItem('stock_exchange_rate', exchangeRate.toString());
  }, [exchangeRate]);

  useEffect(() => {
    localStorage.setItem('stock_theme', theme);
    // document element 클래스에 테마 반영
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('gemini_api_key', apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem('chat_messages', JSON.stringify(chatMessages));
  }, [chatMessages]);

  // ==========================================
  // [데이터 백오피스] JSON 백업 및 복원 핸들러
  // ==========================================
  
  // 데이터 내보내기 (JSON Export)
  const handleExportData = () => {
    const backupData = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      transactions,
      currentPrices,
      exchangeRate
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    
    const today = new Date().toISOString().split('T')[0];
    downloadAnchor.setAttribute("download", `주식가계부_백업_${today}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // 데이터 가져오기 (JSON Import)
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const file = e.target.files?.[0];
    
    if (!file) return;

    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        
        // 간단한 스키마 적합성 유효성 검사
        if (Array.isArray(parsed.transactions) && typeof parsed.currentPrices === 'object') {
          if (confirm("정말로 백업 파일의 데이터로 대체하시겠습니까? (현재 기록된 데이터는 유실됩니다)")) {
            setTransactions(parsed.transactions);
            setCurrentPrices(parsed.currentPrices);
            if (parsed.exchangeRate) {
              setExchangeRate(Number(parsed.exchangeRate));
              setTempRate(parsed.exchangeRate.toString());
            }
            alert("데이터가 완벽하게 성공적으로 복원되었습니다!");
          }
        } else {
          alert("유효한 주식 가계부 백업 JSON 파일이 아닙니다.");
        }
      } catch (err) {
        alert("백업 파일을 읽는 도중 오류가 발생했습니다. 파일 형식을 확인해주세요.");
      }
    };
    
    fileReader.readAsText(file);
    // 동일 파일 재업로드 이벤트를 위해 값 초기화
    e.target.value = '';
  };

  // ==========================================
  // [비즈니스 로직 제어 함수군]
  // ==========================================
  
  // 가. 신규 거래 등록
  const handleAddTransaction = (newTx: Omit<Transaction, 'id'>) => {
    const txWithId: Transaction = {
      ...newTx,
      id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    
    setTransactions((prev) => [txWithId, ...prev]);

    // 해당 종목의 최초 가상 현재가를 등록된 매수단가(단위 통화 기준)로 즉시 추가
    if (currentPrices[newTx.ticker] === undefined) {
      setCurrentPrices((prev) => ({
        ...prev,
        [newTx.ticker]: newTx.price
      }));
    }
  };

  // 나. 거래 삭제
  const handleDeleteTransaction = (id: string) => {
    if (confirm("정말로 이 거래 내역을 삭제하시겠습니까?")) {
      setTransactions((prev) => prev.filter((tx) => tx.id !== id));
    }
  };

  // 다. 가상 현재가 업데이트 (해당 종목 고유 통화 기준 단가 반영)
  const handleUpdateCurrentPrice = (ticker: string, price: number) => {
    setCurrentPrices((prev) => ({
      ...prev,
      [ticker]: price
    }));
  };

  // 라. AI 상담 메시지 추가
  const handleAddChatMessage = (newMsg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const chatWithMetadata: ChatMessage = {
      ...newMsg,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    };
    setChatMessages((prev) => [...prev, chatWithMetadata]);
  };

  // 마. 대화 초기화
  const handleClearMessages = () => {
    if (confirm("AI 자문관과의 대화 기록을 모두 초기화하시겠습니까?")) {
      setChatMessages([]);
    }
  };

  // 바. 데모 리셋
  const handleResetToDemo = () => {
    if (confirm("현재 가계부의 모든 데이터를 초기 데모 샘플 데이터로 리셋하시겠습니까? (기존 기록은 삭제됩니다)")) {
      setTransactions(INITIAL_DEMO_TRANSACTIONS);
      setCurrentPrices(INITIAL_DEMO_PRICES);
      setExchangeRate(1380);
      setTempRate("1380");
      setChatMessages([]);
    }
  };

  // 사. 환율 일괄 저장
  const handleSaveRate = () => {
    const parsed = Number(tempRate);
    if (!isNaN(parsed) && parsed > 0) {
      setExchangeRate(parsed);
      setShowRateModal(false);
    } else {
      alert("0보다 큰 올바른 숫자를 입력해주세요.");
    }
  };

  return (
    <div className="min-h-screen pb-12 transition-colors duration-300">
      {/* 1. 글로벌 내비게이션 헤더 */}
      <header className="border-b border-slate-200 dark:border-slate-900 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* 로고 & 타이틀 */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-indigo-600 rounded-xl shadow-lg shadow-cyan-500/20 dark:shadow-cyan-950/40">
              <TrendingUp className="w-5.5 h-5.5 text-white" />
            </div>
            <div>
              <h1 className="text-base lg:text-lg font-extrabold text-slate-800 dark:text-slate-100 font-sans tracking-wide flex items-center gap-2">
                <span className="text-gradient-shine">AI 스마트 주식 가계부</span>
                <span className="text-3xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 border border-slate-200 dark:border-slate-700/60">
                  ULTRA v1.5
                </span>
              </h1>
              <p className="text-3xs text-slate-500 dark:text-slate-600 font-medium">하이브리드 다중 통화 환산 엔진 & Gemini 멀티턴 포트폴리오 자문사</p>
            </div>
          </div>

          {/* 제어 백오피스 컴포넌트바 */}
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {/* 다크/라이트 모드 스위치 */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
              title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
            </button>

            {/* 환율 세팅 패널 */}
            <button
              onClick={() => { setTempRate(exchangeRate.toString()); setShowRateModal(true); }}
              className="flex items-center gap-1 text-3xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl transition-all"
              title="가상 고정 환율 세팅"
            >
              <Settings className="w-3.5 h-3.5 text-cyan-500" />
              <span>환율: ₩{exchangeRate.toLocaleString()}</span>
            </button>

            {/* 기준 통화 토글 (₩ / $) */}
            <div className="flex bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-0.5 rounded-xl">
              <button
                onClick={() => setBaseCurrency('KRW')}
                className={`text-3xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                  baseCurrency === 'KRW'
                    ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                KRW (₩)
              </button>
              <button
                onClick={() => setBaseCurrency('USD')}
                className={`text-3xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                  baseCurrency === 'USD'
                    ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                USD ($)
              </button>
            </div>

            {/* 백업 파일 내보내기 */}
            <button
              onClick={handleExportData}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
              title="가계부 데이터 파일 백업 (내보내기)"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* 백업 파일 복구 */}
            <label
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
              title="백업 파일에서 데이터 복원 (가져오기)"
            >
              <Upload className="w-4 h-4" />
              <input
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="hidden"
              />
            </label>

            {/* 데모 리셋 */}
            <button
              onClick={handleResetToDemo}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
              title="샘플 데이터 리셋"
            >
              <RefreshCw className="w-4 h-4 text-amber-500" />
            </button>
          </div>

        </div>
      </header>

      {/* 2. 환율 조정 모달 다이얼로그 */}
      {showRateModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card p-6 max-w-sm w-full space-y-4 animate-fadeIn">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <DollarSign className="w-5 h-5 text-cyan-400" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">가상 기준 환율 조정 설정</h3>
            </div>
            <p className="text-3xs text-slate-500 dark:text-slate-400 leading-relaxed">
              서로 다른 화폐 단위(₩ 및 $)로 매수된 자산을 글로벌 기준 화폐로 합산하여 대시보드에 환산 표출할 때 사용될 실시간 적용 환율을 조정합니다.
            </p>
            <div>
              <label className="block text-4xs font-bold text-slate-400 mb-1.5 uppercase">1 달러(USD) 당 원화(KRW) 가치</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">₩</span>
                <input
                  type="number"
                  value={tempRate}
                  onChange={(e) => setTempRate(e.target.value)}
                  className="form-input pl-7 font-bold text-xs"
                  placeholder="예: 1380"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowRateModal(false)}
                className="btn-secondary text-xs px-4 py-2"
              >
                취소
              </button>
              <button
                onClick={handleSaveRate}
                className="btn-primary text-xs px-4 py-2"
              >
                환율 적용
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. 대시보드 메인 레이아웃 */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 mt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* 가. 좌측 2단 영역: 거래 등록 폼 & 테이블 분석 */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* 신규 거래 폼 */}
            <StockForm onAddTransaction={handleAddTransaction} />

            {/* 종합 자산 현황 테이블 */}
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-cyan-400 animate-pulse" />
                  <h3 className="text-sm lg:text-base font-extrabold text-slate-800 dark:text-slate-100">나의 투자 자산 종합 진단판</h3>
                </div>
                <span className="text-4xs text-slate-500 font-semibold uppercase flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  기준 통화: {baseCurrency}
                </span>
              </div>
              
              <PortfolioTable
                transactions={transactions}
                currentPrices={currentPrices}
                baseCurrency={baseCurrency}
                exchangeRate={exchangeRate}
                onDeleteTransaction={handleDeleteTransaction}
                onUpdateCurrentPrice={handleUpdateCurrentPrice}
              />
            </div>
          </div>

          {/* 나. 우측 1단 영역: AI 투자 챗존 */}
          <div className="lg:col-span-5">
            <StockAdvisorChat
              transactions={transactions}
              currentPrices={currentPrices}
              baseCurrency={baseCurrency}
              exchangeRate={exchangeRate}
              apiKey={apiKey}
              onApiKeyChange={setApiKey}
              messages={chatMessages}
              onAddMessage={handleAddChatMessage}
              onClearMessages={handleClearMessages}
            />
          </div>

        </div>
      </main>

      {/* 4. 푸터 */}
      <footer className="max-w-7xl mx-auto px-4 lg:px-8 mt-12 pt-6 border-t border-slate-200 dark:border-slate-900 text-center space-y-2 select-none">
        <p className="text-3xs text-slate-500 dark:text-slate-600 font-medium">
          본 애플리케이션은 서버가 없는(No-Backend) 로컬 독립형 브라우저 구동 클라이언트 SPA 구조입니다.
        </p>
        <p className="text-4xs text-slate-500 dark:text-slate-700">
          © 2026 AI Stock Ledger Inc. Powered by React 19, Tailwind CSS & Google Gemini 2.5 Flash.
        </p>
      </footer>
    </div>
  );
}
