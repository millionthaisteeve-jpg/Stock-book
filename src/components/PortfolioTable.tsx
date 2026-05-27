import React, { useState } from 'react';
import { Trash2, Edit2, TrendingUp, TrendingDown, DollarSign, PieChart, List, FileText, Check } from 'lucide-react';
import { Transaction, PortfolioItem, SectorAllocation } from '../types';

interface PortfolioTableProps {
  transactions: Transaction[];
  currentPrices: { [ticker: string]: number };
  baseCurrency: 'KRW' | 'USD';
  exchangeRate: number;
  onDeleteTransaction: (id: string) => void;
  onUpdateCurrentPrice: (ticker: string, price: number) => void;
}

const SECTOR_COLORS = [
  '#22d3ee', // Cyan
  '#6366f1', // Indigo
  '#34d399', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#a855f7', // Purple
  '#f43f5e', // Rose
  '#10b981', // Green
];

export default function PortfolioTable({
  transactions,
  currentPrices,
  baseCurrency,
  exchangeRate,
  onDeleteTransaction,
  onUpdateCurrentPrice,
}: PortfolioTableProps) {
  const [activeTab, setActiveTab] = useState<'portfolio' | 'transactions'>('portfolio');
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState<string>('');

  // =========================================================
  // [헬퍼] 통화 포맷터 (KRW는 소수점 제거, USD는 소수점 2자리 유지)
  // =========================================================
  const formatCurrency = (value: number): string => {
    if (baseCurrency === 'KRW') {
      return `₩ ${Math.round(value).toLocaleString()}`;
    } else {
      return `$ ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  };

  // =========================================================
  // [계산 로직] 1. 종목별 자산 데이터 취합 및 하이브리드 통화 환산
  // =========================================================
  const calculatePortfolio = (): PortfolioItem[] => {
    // 종목별 취합을 위한 임시 맵
    const stockMap: {
      [ticker: string]: {
        ticker: string;
        sector: string;
        totalQuantity: number;
        totalCostInBase: number;
        originalCurrency: 'KRW' | 'USD';
      };
    } = {};

    transactions.forEach((tx) => {
      if (!stockMap[tx.ticker]) {
        stockMap[tx.ticker] = {
          ticker: tx.ticker,
          sector: tx.sector,
          totalQuantity: 0,
          totalCostInBase: 0,
          originalCurrency: tx.currency, // 종목 고유의 거래 통화로 매핑
        };
      }
      
      stockMap[tx.ticker].totalQuantity += tx.quantity;
      
      // [환산 수식] 개별 거래 가격을 현재 글로벌 기준통화(baseCurrency)로 환전 계산
      let costInBase = tx.price * tx.quantity;
      if (tx.currency === 'USD' && baseCurrency === 'KRW') {
        costInBase = (tx.price * exchangeRate) * tx.quantity; // USD -> KRW
      } else if (tx.currency === 'KRW' && baseCurrency === 'USD') {
        costInBase = (tx.price / exchangeRate) * tx.quantity; // KRW -> USD
      }
      
      stockMap[tx.ticker].totalCostInBase += costInBase;
    });

    const items: PortfolioItem[] = Object.values(stockMap).map((stock) => {
      // 1. 기준 통화 환산 기준 평단가
      const averagePrice = stock.totalQuantity > 0 ? stock.totalCostInBase / stock.totalQuantity : 0;
      
      // 2. 종목 고유 화폐 기준으로 저장된 현재가 추출 (없으면 고유 화폐 기준 평단가 계산)
      let storedCurrentPrice = currentPrices[stock.ticker];
      if (storedCurrentPrice === undefined) {
        // 고유 화폐 기준 평단가 역추적
        const originalCost = transactions
          .filter(t => t.ticker === stock.ticker)
          .reduce((sum, t) => sum + (t.price * t.quantity), 0);
        storedCurrentPrice = stock.totalQuantity > 0 ? originalCost / stock.totalQuantity : 0;
      }

      // 3. 종목 고유 현재가를 글로벌 기준 통화(baseCurrency)로 변환
      let currentPriceInBase = storedCurrentPrice;
      if (stock.originalCurrency === 'USD' && baseCurrency === 'KRW') {
        currentPriceInBase = storedCurrentPrice * exchangeRate; // USD -> KRW 현재가 환산
      } else if (stock.originalCurrency === 'KRW' && baseCurrency === 'USD') {
        currentPriceInBase = storedCurrentPrice / exchangeRate; // KRW -> USD 현재가 환산
      }

      // 4. 평가 금액 = 총 수량 * 환산된 현재가
      const currentValue = stock.totalQuantity * currentPriceInBase;
      
      // 5. 평가 손익 = 평가 금액 - 환산된 총 매수 원금
      const gainOrLoss = currentValue - stock.totalCostInBase;
      
      // 6. 수익률 (%)
      const returnRate = stock.totalCostInBase > 0 ? (gainOrLoss / stock.totalCostInBase) * 100 : 0;

      return {
        ticker: stock.ticker,
        sector: stock.sector,
        totalQuantity: stock.totalQuantity,
        averagePrice,
        totalCost: stock.totalCostInBase,
        currentPrice: currentPriceInBase, // 스위칭된 기준 통화 기준 단가 전달
        currentValue,
        gainOrLoss,
        returnRate,
        ratio: 0
      };
    });

    // 전체 총 투자 원금 환산 합계 (비중 계산용)
    const overallTotalCost = items.reduce((sum, item) => sum + item.totalCost, 0);

    // 투자 비중 재계산
    return items.map((item) => ({
      ...item,
      ratio: overallTotalCost > 0 ? (item.totalCost / overallTotalCost) * 100 : 0
    }));
  };

  const portfolioItems = calculatePortfolio();

  // =========================================================
  // [계산 로직] 2. 섹터별 투자 비중 분석
  // =========================================================
  const calculateSectors = (): SectorAllocation[] => {
    const sectorMap: { [sector: string]: number } = {};
    let overallTotalCost = 0;

    portfolioItems.forEach((item) => {
      sectorMap[item.sector] = (sectorMap[item.sector] || 0) + item.totalCost;
      overallTotalCost += item.totalCost;
    });

    return Object.entries(sectorMap)
      .map(([sector, cost], index) => ({
        sector,
        totalCost: cost,
        ratio: overallTotalCost > 0 ? (cost / overallTotalCost) * 100 : 0,
        color: SECTOR_COLORS[index % SECTOR_COLORS.length]
      }))
      .sort((a, b) => b.totalCost - a.totalCost);
  };

  const sectorAllocations = calculateSectors();

  // =========================================================
  // [계산 로직] 3. 자산 종합 통계
  // =========================================================
  const totalInvestment = portfolioItems.reduce((sum, item) => sum + item.totalCost, 0);
  const totalEvaluation = portfolioItems.reduce((sum, item) => sum + item.currentValue, 0);
  const overallGainOrLoss = totalEvaluation - totalInvestment;
  const overallReturnRate = totalInvestment > 0 ? (overallGainOrLoss / totalInvestment) * 100 : 0;

  // 현재가 인라인 편집 모드 진입
  const startEditPrice = (ticker: string, currentPriceInBase: number) => {
    setEditingTicker(ticker);
    // 현재 표시되고 있는 기준 화폐 금액을 인풋창에 노출 (사용자는 보여지는 통화 기준으로 편집)
    setEditPriceValue(currentPriceInBase.toFixed(baseCurrency === 'KRW' ? 0 : 2));
  };

  // 현재가 수정 완료 및 절대 통화 역환전 저장
  const savePrice = (ticker: string) => {
    const parsedPrice = Number(editPriceValue);
    if (!isNaN(parsedPrice) && parsedPrice >= 0) {
      
      // 해당 종목의 최초 거래 화폐 정보를 조회
      const matchTx = transactions.find(t => t.ticker === ticker);
      const originalCurrency = matchTx ? matchTx.currency : 'KRW';

      // [역환전 수식] 사용자가 기입한 기준 화폐 금액을 종목의 고유 화폐 절대값 단가로 역환전하여 저장
      let originalPriceValue = parsedPrice;
      if (originalCurrency === 'USD' && baseCurrency === 'KRW') {
        originalPriceValue = parsedPrice / exchangeRate; // KRW 입력 -> USD 변환
      } else if (originalCurrency === 'KRW' && baseCurrency === 'USD') {
        originalPriceValue = parsedPrice * exchangeRate; // USD 입력 -> KRW 변환
      }

      onUpdateCurrentPrice(ticker, originalPriceValue);
    }
    setEditingTicker(null);
  };

  // =========================================================
  // [시각화] 보정된 SVG 도넛 차트 $2\pi r$ 수학 궤적 계산
  // =========================================================
  const r = 40;
  const circumference = 2 * Math.PI * r; // 대략 251.327
  let accumulatedPercentage = 0;

  return (
    <div className="space-y-6">
      {/* 1. 상단 자산 종합 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 총 투자 원금 */}
        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-300">
            <DollarSign className="w-24 h-24 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-4xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">총 투자 원금 (원금)</p>
          <p className="text-xl lg:text-2xl font-black text-slate-800 dark:text-slate-100 font-sans">
            {formatCurrency(totalInvestment)}
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-4xs text-slate-400 dark:text-slate-500 font-medium">
            <span>총 {portfolioItems.length}개 자산 보유 중</span>
          </div>
        </div>

        {/* 현재 평가 금액 */}
        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-300">
            <TrendingUp className="w-24 h-24 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-4xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">현재 평가 자산</p>
          <p className="text-xl lg:text-2xl font-black text-slate-800 dark:text-slate-100 font-sans">
            {formatCurrency(totalEvaluation)}
          </p>
          <div className="mt-3 flex items-center gap-1">
            <span className="text-4xs text-slate-400 dark:text-slate-500 font-medium">총 평가 손익: </span>
            <span className={`text-4xs font-bold flex items-center ${
              overallGainOrLoss > 0 ? 'text-emerald-500' : overallGainOrLoss < 0 ? 'text-rose-500' : 'text-slate-400'
            }`}>
              {overallGainOrLoss > 0 ? '+' : ''}
              {formatCurrency(overallGainOrLoss)}
            </span>
          </div>
        </div>

        {/* 종합 수익률 */}
        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-300">
            {overallReturnRate >= 0 ? (
              <TrendingUp className="w-24 h-24 text-emerald-500/20" />
            ) : (
              <TrendingDown className="w-24 h-24 text-rose-500/20" />
            )}
          </div>
          <p className="text-4xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">포트폴리오 종합 수익률</p>
          <p className={`text-2xl lg:text-3xl font-black font-sans flex items-baseline gap-0.5 ${
            overallReturnRate > 0 ? 'text-emerald-500' : overallReturnRate < 0 ? 'text-rose-500' : 'text-slate-400'
          }`}>
            {overallReturnRate > 0 ? '+' : ''}
            {overallReturnRate.toFixed(2)}
            <span className="text-xs font-medium">%</span>
          </p>
          <div className="mt-2.5">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-4xs font-bold ${
              overallReturnRate >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
            }`}>
              {overallReturnRate >= 0 ? '자산 성장 상태' : '위험 분산 필요'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. 보정된 SVG 파이 차트 대시보드 */}
      {sectorAllocations.length > 0 && (
        <div className="grid grid-cols-1 gap-6">
          <div className="glass-card p-6 flex flex-col md:flex-row gap-8 items-center">
            
            {/* 수학식 보정이 완료된 SVG 도넛 차트 */}
            <div className="relative w-36 h-36 shrink-0 flex items-center justify-center bg-slate-100/50 dark:bg-slate-950/20 rounded-full p-2 border border-slate-200/40 dark:border-slate-800/40">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* 트랙 배경 원 */}
                <circle cx="50" cy="50" r={r} fill="transparent" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="12" />
                
                {/* 정합한 비율 원 그리기 */}
                {sectorAllocations.map((sa) => {
                  const dashShare = (sa.ratio / 100) * circumference;
                  const strokeDasharray = `${dashShare} ${circumference - dashShare}`;
                  const strokeDashoffset = -((accumulatedPercentage / 100) * circumference);
                  accumulatedPercentage += sa.ratio;
                  
                  return (
                    <circle
                      key={sa.sector}
                      cx="50"
                      cy="50"
                      r={r}
                      fill="transparent"
                      stroke={sa.color}
                      strokeWidth="12"
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      className="transition-all duration-500 hover:stroke-[14]"
                    />
                  );
                })}
              </svg>
              {/* 중앙 정보 칩 */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <PieChart className="w-4 h-4 text-slate-400 dark:text-slate-500 mb-0.5" />
                <span className="text-4xs text-slate-500 font-bold tracking-wider">섹터 분포</span>
                <span className="text-2xs font-extrabold text-cyan-500 dark:text-cyan-400 mt-0.5">{sectorAllocations.length}개 분야</span>
              </div>
            </div>

            {/* 섹터 설명 범례 */}
            <div className="flex-1 w-full space-y-3.5">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                <PieChart className="w-4 h-4 text-cyan-500" />
                투자 포트폴리오 섹터별 구성비
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {sectorAllocations.map((sa) => (
                  <div key={sa.sector} className="space-y-1">
                    <div className="flex items-center justify-between text-4xs lg:text-3xs font-semibold">
                      <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: sa.color }} />
                        {sa.sector}
                      </span>
                      <span className="text-slate-800 dark:text-slate-200">
                        {sa.ratio.toFixed(1)}% <span className="text-slate-400 dark:text-slate-550 font-normal">({formatCurrency(sa.totalCost)})</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-200/80 dark:bg-slate-950/60 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500" 
                        style={{ width: `${sa.ratio}%`, backgroundColor: sa.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. 데이터 탭 및 리스트 테이블 */}
      <div className="glass-card overflow-hidden">
        {/* 탭 컨트롤러 */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`flex items-center gap-2 px-4 lg:px-5 py-3.5 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'portfolio'
                ? 'text-cyan-600 dark:text-cyan-400 border-cyan-550 dark:border-cyan-400 bg-white dark:bg-slate-900/60'
                : 'text-slate-400 border-transparent hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            종목별 종합 분석 포트폴리오
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex items-center gap-2 px-4 lg:px-5 py-3.5 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'transactions'
                ? 'text-cyan-600 dark:text-cyan-400 border-cyan-550 dark:border-cyan-400 bg-white dark:bg-slate-900/60'
                : 'text-slate-400 border-transparent hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            상세 매입 거래 기록 ({transactions.length}건)
          </button>
        </div>

        {/* 테이블 본문 */}
        <div className="p-3 overflow-x-auto">
          {transactions.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">등록된 주식 거래 이력이 없습니다.</div>
          ) : activeTab === 'portfolio' ? (
            <table className="w-full text-left border-collapse min-w-[700px] text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-semibold select-none">
                  <th className="py-2.5 px-2">종목명</th>
                  <th className="py-2.5 px-2">분야 / 섹터</th>
                  <th className="py-2.5 px-2 text-right">보유 수량</th>
                  <th className="py-2.5 px-2 text-right">평균 매수단가</th>
                  <th className="py-2.5 px-2 text-right">투자 원금</th>
                  <th className="py-2.5 px-2 text-right text-cyan-500 dark:text-cyan-450 w-44">
                    <span className="flex items-center justify-end gap-1">현재가 수정 <Edit2 className="w-3 h-3" /></span>
                  </th>
                  <th className="py-2.5 px-2 text-right">평가 금액</th>
                  <th className="py-2.5 px-2 text-right">평가 손익</th>
                  <th className="py-2.5 px-2 text-right">수익률</th>
                  <th className="py-2.5 px-2 text-right">비중</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-900 text-slate-600 dark:text-slate-350">
                {portfolioItems.map((item) => (
                  <tr key={item.ticker} className="hover:bg-slate-100/30 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="py-2.5 px-2 font-bold text-slate-800 dark:text-slate-100">{item.ticker}</td>
                    <td className="py-2.5 px-2">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-4xs font-bold">
                        {item.sector}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-right font-medium">{item.totalQuantity.toLocaleString()}주</td>
                    <td className="py-2.5 px-2 text-right">{formatCurrency(item.averagePrice)}</td>
                    <td className="py-2.5 px-2 text-right font-semibold">{formatCurrency(item.totalCost)}</td>
                    
                    {/* 현재가 인라인 편집 */}
                    <td className="py-2.5 px-2 text-right">
                      {editingTicker === item.ticker ? (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            step="any"
                            value={editPriceValue}
                            onChange={(e) => setEditPriceValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') savePrice(item.ticker);
                              if (e.key === 'Escape') setEditingTicker(null);
                            }}
                            className="bg-slate-100 dark:bg-slate-950 border border-cyan-500 text-right rounded px-1.5 py-0.5 w-24 text-slate-800 dark:text-slate-100 font-extrabold outline-none text-3xs"
                            autoFocus
                          />
                          <button
                            onClick={() => savePrice(item.ticker)}
                            className="p-0.5 rounded bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition-colors"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditPrice(item.ticker, item.currentPrice)}
                          className="group/btn ml-auto flex items-center justify-end gap-1 text-slate-700 dark:text-slate-200 font-bold border-b border-dashed border-slate-300 dark:border-slate-700 hover:border-cyan-500 transition-all"
                        >
                          {formatCurrency(item.currentPrice)}
                        </button>
                      )}
                    </td>

                    <td className="py-2.5 px-2 text-right font-bold text-slate-800 dark:text-slate-100">{formatCurrency(item.currentValue)}</td>
                    
                    {/* 평가손익 */}
                    <td className={`py-2.5 px-2 text-right font-bold ${
                      item.gainOrLoss > 0 ? 'text-emerald-500' : item.gainOrLoss < 0 ? 'text-rose-500' : 'text-slate-400'
                    }`}>
                      {item.gainOrLoss > 0 ? '+' : ''}
                      {formatCurrency(item.gainOrLoss)}
                    </td>

                    {/* 수익률 */}
                    <td className={`py-2.5 px-2 text-right font-black ${
                      item.returnRate > 0 ? 'text-emerald-500' : item.returnRate < 0 ? 'text-rose-500' : 'text-slate-400'
                    }`}>
                      {item.returnRate > 0 ? '+' : ''}
                      {item.returnRate.toFixed(2)}%
                    </td>

                    <td className="py-2.5 px-2 text-right font-semibold text-slate-400 dark:text-slate-500">{item.ratio.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse min-w-[600px] text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-semibold select-none">
                  <th className="py-2.5 px-2">매수일자</th>
                  <th className="py-2.5 px-2">종목명</th>
                  <th className="py-2.5 px-2">분야 / 섹터</th>
                  <th className="py-2.5 px-2 text-right">매수 단가 (지정 화폐)</th>
                  <th className="py-2.5 px-2 text-right">매수 수량</th>
                  <th className="py-2.5 px-2 text-right">거래 총액 (지정 화폐)</th>
                  <th className="py-2.5 px-2 text-center w-16">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-900 text-slate-600 dark:text-slate-400">
                {[...transactions]
                  .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())
                  .map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-100/30 dark:hover:bg-slate-800/10 transition-colors">
                      <td className="py-2.5 px-2 text-slate-400 font-sans">{tx.purchaseDate}</td>
                      <td className="py-2.5 px-2 font-bold text-slate-800 dark:text-slate-100">{tx.ticker}</td>
                      <td className="py-2.5 px-2">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-4xs font-bold">
                          {tx.sector}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right font-medium text-slate-700 dark:text-slate-300">
                        {tx.currency === 'KRW' ? `₩ ${tx.price.toLocaleString()}` : `$ ${tx.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                      </td>
                      <td className="py-2.5 px-2 text-right">{tx.quantity.toLocaleString()}주</td>
                      <td className="py-2.5 px-2 text-right font-bold text-slate-800 dark:text-slate-200">
                        {tx.currency === 'KRW' 
                          ? `₩ ${(tx.price * tx.quantity).toLocaleString()}` 
                          : `$ ${(tx.price * tx.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <button
                          onClick={() => onDeleteTransaction(tx.id)}
                          className="btn-danger p-1.5 rounded-lg border border-rose-500/20"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
