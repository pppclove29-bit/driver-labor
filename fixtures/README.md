# fixtures

외부 API 샘플 응답. 실제 키로 반복 호출하지 않고 이 파일로 개발·테스트한다.

- `kakao/directions-seoul-gangneung.json` 서울 강남역 → 강릉 경포해변 (거리 약 228km, 통행료, 택시요금, 도로별 교통 상태 포함)
- `kakao/directions-seoul-wonju.json`, `kakao/directions-wonju-gangneung.json` 하차 장소 선택 시 재조회용
- `kakao/places-gangneung.json` 장소 검색
- `tmap/route-seoul-gangneung.json` 예비 제공자 어댑터 테스트용
- `opinet/avg-sido.json` 시·도별 평균 유가

실제 응답 형식은 각 사 문서 기준으로 M3에서 작성한다. 개인정보가 들어가지 않게 한다.
