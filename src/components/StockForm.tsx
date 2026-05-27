import React, { useState } from 'react';
import { PlusCircle, AlertCircle, Calendar, DollarSign, Tag, Briefcase, Info } from 'lucide-react';
import { Transaction } from '../types';

interface StockFormProps {
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void;
}

const RECOMMENDED_SECTORS = [
  '반도체',
  '테크 / 빅테크',
  '바이오 / 헬스케어',
  '자동차 / 2차전지',
  '금융 / 은행',
  '소비재 / 유통',
  '에너지 / 화학',
  '통신 / 미디어'
];

export default function StockForm({ onAddTransaction }: StockFormProps) {
  const [ticker, setTicker] = useState('');
  const [sector, setSector] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [currency, setCurrency] = useState<'KRW' | 'USD'>('KRW'); // 거래 통화
  
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateForm = (): boolean => {
    const tempErrors: { [key: string]: string } = {};
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (!ticker.trim()) {
      tempErrors.ticker = '종목명을 입력해주세요.';
    }
    
    if (!sector.trim()) {
      tempErrors.sector = '분야/섹터를 지정해주세요.';
    }
    
    if (!purchaseDate) {
      tempErrors.purchaseDate = '매수 날짜를 선택해주세요.';
    } else if (purchaseDate > todayStr) {
      tempErrors.purchaseDate = '미래의 날짜는 선택할 수 없습니다.';
    }
    
    const parsedPrice = Number(price);
    if (!price || isNaN(parsedPrice) || parsedPrice <= 0) {
      tempErrors.price = '0보다 큰 매수 단가를 입력해주세요.';
    }
    
    const parsedQuantity = Number(quantity);
    if (!quantity || isNaN(parsedQuantity) || parsedQuantity <= 0) {
      tempErrors.quantity = '0보다 큰 매수 수량을 입력해주세요.';
    } else if (!Number.isInteger(parsedQuantity)) {
      tempErrors.quantity = '정수 단위 수량을 입력해주세요 (소수점 불가).';
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onAddTransaction({
        ticker: ticker.trim().toUpperCase(),
        sector: sector.trim(),
        purchaseDate,
        price: Number(price),
        quantity: Number(quantity),
        currency
      });

      setTicker('');
      setPrice('');
      setQuantity('');
      setErrors({});
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <PlusCircle className="text-cyan-500 dark:text-cyan-400 w-5 h-5" />
          <h3 className="text-sm lg:text-base font-bold text-slate-800 dark:text-slate-100">새로운 매수 내역 등록</h3>
        </div>
        <span className="text-4xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
          <Info className="w-3 h-3" /> 개별 거래 통화 기입 지원
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 종목명 및 거래 통화 선택 스위치 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-4xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              종목명 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="예: 삼성전자, Apple, TSMC"
              className={`form-input text-xs ${errors.ticker ? 'border-rose-500/80 focus:ring-rose-500/20' : ''}`}
            />
            {errors.ticker && (
              <p className="mt-1 text-4xs text-rose-500 flex items-center gap-1 font-semibold">
                <AlertCircle className="w-3 h-3" /> {errors.ticker}
              </p>
            )}
          </div>

          <div>
            <label className="block text-4xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              거래 화폐 단위 <span className="text-rose-500">*</span>
            </label>
            <div className="flex bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-0.5 rounded-xl">
              <button
                key="KRW"
                type="button"
                onClick={() => setCurrency('KRW')}
                className={`flex-1 text-4xs font-bold py-2 rounded-lg transition-all ${
                  currency === 'KRW'
                    ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                KRW (₩)
              </button>
              <button
                key="USD"
                type="button"
                onClick={() => setCurrency('USD')}
                className={`flex-1 text-4xs font-bold py-2 rounded-lg transition-all ${
                  currency === 'USD'
                    ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                USD ($)
              </button>
            </div>
          </div>
        </div>

        {/* 분야/섹터 */}
        <div>
          <label className="block text-4xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            투자 분야 / 섹터 <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            placeholder="직접 입력하거나 아래 칩을 누르세요..."
            className={`form-input text-xs ${errors.sector ? 'border-rose-500/80 focus:ring-rose-500/20' : ''}`}
          />
          <div className="flex flex-wrap gap-1 mt-2">
            {RECOMMENDED_SECTORS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSector(s)}
                className={`text-4xs px-2.5 py-0.5 rounded-full border transition-all ${
                  sector === s
                    ? 'bg-cyan-500/10 text-cyan-500 dark:text-cyan-400 border-cyan-500/30 font-semibold'
                    : 'bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {errors.sector && (
            <p className="mt-1 text-4xs text-rose-500 flex items-center gap-1 font-semibold">
              <AlertCircle className="w-3 h-3" /> {errors.sector}
            </p>
          )}
        </div>

        {/* 날짜 입력 (미래 차단) */}
        <div>
          <label className="block text-4xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            매수 날짜 <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            max={new Date().toISOString().split('T')[0]} // 오늘 이후 입력 차단 브라우저 레벨 적용
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            className={`form-input text-xs ${errors.purchaseDate ? 'border-rose-500/80 focus:ring-rose-500/20' : ''}`}
          />
          {errors.purchaseDate && (
            <p className="mt-1 text-4xs text-rose-500 flex items-center gap-1 font-semibold">
              <AlertCircle className="w-3 h-3" /> {errors.purchaseDate}
            </p>
          )}
        </div>

        {/* 수량 및 가격 입력 */}
        <div className="grid grid-cols-2 gap-4">
          {/* 매수 단가 */}
          <div>
            <label className="block text-4xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              매수 단가 ({currency === 'KRW' ? '₩' : '$'}) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="0.01"
              step="any"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={currency === 'KRW' ? '예: 72000' : '예: 175.5'}
              className={`form-input text-xs ${errors.price ? 'border-rose-500/80' : ''}`}
            />
            {errors.price && (
              <p className="mt-1 text-4xs text-rose-500 flex items-center gap-1 font-semibold leading-tight">
                <AlertCircle className="w-3 h-3 shrink-0" /> {errors.price}
              </p>
            )}
          </div>

          {/* 매수 수량 */}
          <div>
            <label className="block text-4xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <PlusCircle className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              매수 수량 (주) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="예: 10"
              className={`form-input text-xs ${errors.quantity ? 'border-rose-500/80' : ''}`}
            />
            {errors.quantity && (
              <p className="mt-1 text-4xs text-rose-500 flex items-center gap-1 font-semibold leading-tight">
                <AlertCircle className="w-3 h-3 shrink-0" /> {errors.quantity}
              </p>
            )}
          </div>
        </div>

        {/* 등록 버튼 */}
        <button
          type="submit"
          className="w-full btn-primary py-2.5 flex items-center justify-center gap-1.5 mt-2 font-bold text-xs tracking-wide"
        >
          <PlusCircle className="w-4 h-4" />
          매입 내역 추가하기
        </button>
      </form>
    </div>
  );
}
