# 네이버 자동입찰 관리 화면

```
[브라우저: https://lib0913.github.io/저장소이름/]  ── 본인 접속 키 ──▶
[퍼스트몰: https://sinsungcns.com/cus_autobid_api/call]  (토큰·접속 키는 서버 설정 파일에만)  ── 토큰 ──▶
[구글 Apps Script 웹 앱] ──▶ 구글 시트 / 네이버 API
```

- 화면 파일만 GitHub Pages로 공개합니다. 비밀 값(구글 토큰, 사람별 접속 키)은 **퍼스트몰 서버에만** 있습니다.
- 구글(마케팅팀) 쪽은 바꿀 필요가 없습니다. (전달본 v3 규격 그대로)

## 파일
| 경로 | 올리는 곳 | 내용 |
|---|---|---|
| `index.html`, `config.js`, `autobid.js`, `autobid.css`, `robots.txt` | **GitHub Pages** | 화면 (v3 기준, 중계 주소·접속 키만 수정) |
| `firstmall/custom/sinsungcns/app/controllers/cus_autobid_api.php` | **퍼스트몰 서버** (같은 경로) | 중계: 접속 키 확인 → 토큰 붙여 구글로 |
| `firstmall/custom/sinsungcns/app/config/autobid_config.sample.php` | **퍼스트몰 서버** (같은 경로) | 설정 견본 |
| `autobid_config.php` | **퍼스트몰 서버에서만 생성** | 실제 설정 (구글 주소·토큰·화면 주소·접속 키) — GitHub 금지 |

## 설치
1. 퍼스트몰 서버에 `firstmall/custom/...` 두 파일을 같은 경로로 업로드
2. `https://sinsungcns.com/cus_autobid_api/check` → `curl: true`, `google_443: 연결됨` 확인
3. 서버에서 `autobid_config.sample.php` → `autobid_config.php` 복사 후 입력
   - `gas_url`, `gas_token` (마케팅 담당자에게 받음)
   - `allowed_origins`: `https://lib0913.github.io`
   - `keys`: 사용할 사람마다 `'이름' => '24자 이상 무작위 키'`
4. GitHub 저장소 → Settings → Pages → Branch `main`, `/ (root)` → Save
5. 표시된 주소 접속 → 접속 키 입력 → (구글 입장 코드가 설정돼 있으면) 입장 코드 입력 → 키워드 탭 "화상회의" 검색되면 완료

## 보안
- 중계는 `allowed_origins`에 등록된 화면에서 온 요청만 받음
- 접속 키가 맞아야 통과, 같은 IP에서 10분에 10번 틀리면 10분 잠금
- 허용된 요청 11개만 구글로 전달, 변경 기록의 '누가' = 접속 키 이름
- 키가 새면 `autobid_config.php`의 그 줄을 지우면 즉시 차단
- 무료 GitHub Pages는 공개 저장소가 필요하지만, 저장소에 비밀 값이 없으므로 공개돼도 안전
