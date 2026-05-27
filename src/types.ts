/**
 * 주식 매입 내역 (개별 거래 건) 인터페이스
 */
export interface Transaction {
  id: string;
  ticker: string;       // 종목명 (예: 삼성전자, Apple)
  sector: string;       // 투자 분야/섹터 (예: 반도체, 테크 등)
  purchaseDate: string; // 매수 날짜 (YYYY-MM-DD)
  price: number;        // 매수 단가
  quantity: number;     // 매수 수량 (주)
  currency: 'KRW' | 'USD'; // 거래 시 화폐 단위 (₩ 또는 $)
}

/**
 * 종목별로 합산된 포트폴리오 분석 아이템 인터페이스
 */
export interface PortfolioItem {
  ticker: string;       // 종목명
  sector: string;       // 투자 분야/섹터
  totalQuantity: number;// 총 보유 수량
  averagePrice: number; // 평균 매수 단가 (기준 화폐에 따라 자동 환산)
  totalCost: number;    // 총 투자 금액 (기준 화폐에 따라 자동 환산)
  currentPrice: number; // 현재가 (기준 화폐에 따라 자동 환산, 수정 가능)
  currentValue: number; // 현재 평가 금액
  gainOrLoss: number;   // 평가 손익
  returnRate: number;   // 수익률 (%)
  ratio: number;        // 포트폴리오 내 투자 비중 (%)
}

/**
 * 섹터별 비중 분석 인터페이스
 */
export interface SectorAllocation {
  sector: string;       // 섹터명
  totalCost: number;    // 해당 섹터 총 투자 금액 (기준 화폐 기준)
  ratio: number;        // 비중 (%)
  color: string;        // 시각화용 테마 색상 (RGB/HEX)
}

/**
 * Gemini AI 투자 상담 챗 메시지 인터페이스
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;    // ISO string
}
