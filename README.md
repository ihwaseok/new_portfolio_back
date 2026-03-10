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
- 기본적으로 `http://localhost:3000/docs`

## 프로젝트 기동순서
- `app.js` → `startup/index.js` → ... → `startup/express.js` → `api/index.js` → ...