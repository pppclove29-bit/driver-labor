// 화면 스택. 안드로이드 뒤로 가기 버튼과 화면의 "‹" 버튼이 같은 곳으로 간다.
// 홈에서 한 번 더 누르면 앱을 닫는다(안드로이드 관례).

export type ScreenId =
  | 'home'
  | 'quick'
  | 'started'
  | 'arriveTime'
  | 'payment'
  | 'arrival'
  | 'penalties'
  | 'timeline'
  | 'etc'
  | 'difficulty'
  | 'result'
  | 'edit';

const BACK: Record<ScreenId, ScreenId | 'exit'> = {
  home: 'exit',
  quick: 'home',
  // 시작 확인·도착 시각 확인에서 뒤로 가면 홈. 시간은 계속 재고 있다.
  started: 'home',
  arriveTime: 'home',
  payment: 'timeline',
  etc: 'penalties',
  arrival: 'home',
  penalties: 'arrival',
  timeline: 'arrival',
  difficulty: 'arrival',
  result: 'home',
  edit: 'result',
};

export const backTarget = (screen: ScreenId): ScreenId | 'exit' => BACK[screen];
