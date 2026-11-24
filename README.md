# new_portfolio_back — 새 포트폴리오 API 서버

## 목적

노트 사이트에서 사용할 메뉴 목록 조회와 Joplin 파일 동기화를 제공하는 API 서버입니다. JWT 인증 샘플, API 키 검증, API 문서, 요청 로깅도 포함되어 있습니다. 기존 `PortfolioSite`의 노트 기능과 유사한 역할을 하되, 서버 초기화·라우트·미들웨어·서비스가 분리되어 있습니다.

## 기술 스택

- Node.js, JavaScript ES Modules, Express 5
- MariaDB/MySQL 연결을 위한 `mysql2`
- `dotenv`, CORS
- `jsonwebtoken`, `express-jwt`를 이용한 JWT 생성·검증
- Swagger JSDoc, Swagger UI
- Winston 및 날짜별 로그 파일 관리, 개발 실행용 Nodemon

## 동작 방식

1. `app.js`가 `.env.dev`를 읽고 로거, Swagger, Express, 데이터베이스 연결을 초기화합니다.
2. `API_PREFIX` 아래에 `/sample` API를 등록합니다. 메뉴 조회와 동기화 요청은 `x-auth-key` 헤더를 환경변수 `AUTH_KEY`와 비교해 검증합니다.
3. 메뉴 목록과 특정 부모의 하위 노트를 `admin_menu`에서 조회해 JSON으로 반환합니다.
4. Joplin 동기화 시 `JOPLIN_DIR`을 재귀 탐색해 메뉴 ID·부모 ID·파일 경로를 만들고, 기존 Joplin 메뉴 데이터를 삭제한 뒤 새 데이터를 삽입합니다. Markdown 메타데이터와 이미지 리소스 경로도 수정합니다.
5. 프런트엔드는 이 API에서 메뉴 정보를 받고, 노트 본문은 별도 정적 콘텐츠 서버에서 가져오는 구조입니다.

| 경로 | 역할 |
| --- | --- |
| `/status` | 서버 상태 확인 |
| `<API_PREFIX>/sample/menuList` | 전체 폴더 메뉴 조회 |
| `<API_PREFIX>/sample/menuByParent/:id` | 선택한 폴더의 노트 조회 |
| `<API_PREFIX>/sample/joplinSync` | Joplin 파일·DB 동기화 |
| `<API_PREFIX>/sample/genJwt` | 샘플 JWT 생성 |
| `<API_PREFIX>/sample/testJwt` | JWT 검증 테스트 |
| `/api/docs` | Swagger UI 문서 |

메뉴 기능은 API 키 검증을 사용하며, JWT 기능은 별도 샘플입니다. 이 서버에는 영상 분석이나 WebRTC 미디어 서버 구현은 포함되어 있지 않습니다. 실행에는 DB 연결 정보, 인증 설정, Joplin 경로 등 환경변수와 데이터베이스 테이블이 필요합니다.

**주요 파일:** [진입점](./app.js), [서버 초기화](./src/startup/index.js), [API 라우트](./src/api/route/sample.js), [조회·동기화 서비스](./src/service/sql/sample.js)

## 기존 개발 안내

## 초기실행 시 의존성 설치
```sh
npm install
```

## 개발서버 실행 (터미널은 명령_프롬프트 사용, 파워쉘 X)
```sh
npm run dev
```

## 프로젝트 구조

```text
|-- app.js				        서버의 진입점
|-- package-lock.json
|-- package.json
`-- src
    |-- api				        API 관련 폴더
    |   |-- index.js			API 모듈 통합관리
    |   |-- middleware			API 호출시 사용 미들웨어
    |   |   |-- logging.js		로깅 미들웨어
    |   |   `-- verifyAuth.js	JWT 인증 미들웨어
    |   `-- route			    개별 API 모듈 폴더
    |       `-- sample.js		샘플 API 모듈
    |-- service				    서비스 및 유틸 등 폴더
    |   |-- auth.js			    인증시 사용하는 함수
    |   |-- logger.js			로깅시 사용하는 함수
    |   `-- sql				    SQL 쿼리 폴더
    |       `-- sample.js		샘플 SQL 쿼리
    `-- startup				    서버 실행시 초기화 모듈 폴더
        |-- express.js			Express.js 관련 설정
        |-- index.js			startup 모듈 통합관리
        |-- mariadb.js			MariaDB 연결 설정
        `-- swagger.js			Swagger 문서 설정
```

## Swagger 문서 페이지
- 기본적으로 `http://localhost:<SERVER_PORT>/api/docs`

## 프로젝트 기동순서
- `app.js` → `startup/index.js` → ... → `startup/express.js` → `api/index.js` → ...
