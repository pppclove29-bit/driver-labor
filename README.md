# 운전 노동 정산기 · Claude Code 시작 키트

기획서(`mockups/final.html`)를 Claude Code가 작업하기 좋은 형태로 나눈 저장소 시작점입니다.

## 시작하기

1. 이 폴더를 새 Git 저장소로 만듭니다.
   ```bash
   cd driver-labor
   git init && git add . && git commit -m "기획 문서와 Claude Code 규칙"
   ```
2. Node.js LTS와 pnpm을 설치합니다. Cloudflare 계정은 M3 전까지 필요 없습니다.
3. 이 폴더에서 Claude Code를 실행합니다.
4. 아래 "첫 프롬프트"를 붙여 넣습니다. 계획을 먼저 보여달라고 했으니, 계획을 읽고 괜찮으면 진행을 승인하세요.
5. 마일스톤 하나가 끝날 때마다 결과를 확인하고 커밋한 뒤 다음 마일스톤 프롬프트(`docs/tasks.md`)로 넘어갑니다.

## 첫 프롬프트

```
CLAUDE.md와 docs/tasks.md를 읽고, M0(모노레포 뼈대)의 작업 계획을 세워줘.
코드는 아직 쓰지 말고 계획만 보여줘. 계획에는 만들 폴더·파일 목록,
설치할 패키지와 이유, pnpm 스크립트, M0 완료 기준을 어떻게 확인할지를 포함해줘.
docs/decisions.md와 충돌하거나 애매한 부분이 있으면 먼저 질문해줘.
```

## 폴더

| 경로 | 내용 |
|---|---|
| `CLAUDE.md` | Claude Code가 매 작업마다 읽는 절대 규칙, 스택, 작업 방식 |
| `docs/tasks.md` | 마일스톤 M0~M6, 완료 기준, 계산 테스트 기준값, 확정이 필요한 해석 |
| `docs/spec-calc.md` | 계산 명세 |
| `docs/spec-screens.md` | 화면 명세 (S1~S11 동작 규칙) |
| `docs/architecture.md` | 시스템 설계 |
| `docs/decisions.md` | 결정, 확인 사항, 광고, 로드맵 |
| `mockups/final.html` | 전체 기획서·목업 원본 |
| `fixtures/` | 외부 API 샘플 응답을 둘 곳 (M3에서 작성) |

## 사람이 직접 해야 하는 일

- `docs/tasks.md`의 "확정이 필요한 해석" 항목 검토 (M1 전)
- `docs/decisions.md`의 "남은 확인 사항": 유상운송·위치정보법 법률 검토, 광고 네트워크 조건 (출시 전)
- 카카오모빌리티·TMAP·오피넷 API 키 발급과 `wrangler secret` 등록 (M3 이후, 실제 호출 테스트 직전)
