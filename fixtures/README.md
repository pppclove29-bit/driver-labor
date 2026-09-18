# fixtures

외부 API 샘플 응답. 실제 키로 반복 호출하지 않고 이 파일로 개발·테스트한다.
각 사 문서의 응답 형식을 따라 손으로 만든 값이다. 개인정보는 넣지 않는다(전화번호는 가짜).

| 파일 | 내용 |
|---|---|
| `kakao/directions-seoul-gangneung.json` | 강남역 → 경포해변. 228,214m, 173분, 통행료 12,400원, 택시 231,500원. 정체·지체 4,200m, 원활·40km/h 미만 9,000m |
| `kakao/directions-seoul-wonju.json` | 강남역 → 원주. 하차 장소 선택 시 재조회용 |
| `kakao/directions-wonju-gangneung.json` | 원주 → 경포해변. 하차 장소 선택 시 재조회용 |
| `kakao/places-gangneung.json` | 키워드 "강릉" 장소 검색 6건(상위 5개 자르기 확인용) |
| `tmap/route-seoul-gangneung.json` | 예비 제공자 경로. 229,880m, 177분 |
| `tmap/pois-gangneung.json` | 예비 제공자 POI 검색 6건 |
| `opinet/avg-sido.json` | 시·도 17곳 × 휘발유·경유·LPG 평균가 (+ 고급휘발유 1건, 걸러지는지 확인용) |

좌표: 강남역 (127.0276, 37.4979), 원주 (127.811, 37.328), 경포해변 (128.9086, 37.8055). 경도, 위도 순.
