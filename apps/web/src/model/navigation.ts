// 화면 스택. 안드로이드 뒤로 가기 버튼과 화면의 "‹" 버튼이 같은 곳으로 간다.
// 홈에서 한 번 더 누르면 앱을 닫는다(안드로이드 관례).

export type ScreenId =
  | 'home'
  | 'new'
  | 'quick'
  | 'record'
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
  new: 'home',
  quick: 'home',
  // 여행 중 기록에서 뒤로 가면 홈. 여행은 진행 중인 채로 남는다.
  record: 'home',
  payment: 'record',
  etc: 'record',
  arrival: 'record',
  penalties: 'arrival',
  timeline: 'arrival',
  difficulty: 'arrival',
  result: 'home',
  edit: 'result',
};

export const backTarget = (screen: ScreenId): ScreenId | 'exit' => BACK[screen];
