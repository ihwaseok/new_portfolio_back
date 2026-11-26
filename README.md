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

1. `app.js`가 개발 시 `.env.dev`, `NODE_ENV=production`일 때 `.env.prod`를 읽고 로거, Swagger, Express, 데이터베이스 연결을 초기화합니다. `ENV_FILE`로 파일 경로를 직접 지정할 수도 있습니다.
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
| `<API_PREFIX>/common-codes/:group` | 사용 중인 그룹별 공통코드 조회 (GET) |
| `<API_PREFIX>/common-codes/:group/:code` | 공통코드 값 수정 (PATCH) |
| `<API_PREFIX>/chat/search` | 관련 페이지 검색 (POST) |
| `<API_PREFIX>/chat/messages` | RAG 답변과 관련 페이지 반환 (POST) |
| `<API_PREFIX>/sample/genJwt` | 샘플 JWT 생성 |
| `<API_PREFIX>/sample/testJwt` | JWT 검증 테스트 |
| `/api/docs` | Swagger UI 문서 |

메뉴 기능은 API 키 검증을 사용하며, JWT 기능은 별도 샘플입니다. 이 서버에는 영상 분석이나 WebRTC 미디어 서버 구현은 포함되어 있지 않습니다. 실행에는 DB 연결 정보, 인증 설정, Joplin 경로 등 환경변수와 데이터베이스 테이블이 필요합니다.

**주요 파일:** [진입점](./app.js), [서버 초기화](./src/startup/index.js), [API 라우트](./src/api/route/sample.js), [조회·동기화 서비스](./src/service/sql/sample.js)

## 기존 개발 안내

## 운영 backend 소스 반영

운영 `backend`의 공통코드 라우트·SQL 서비스·수정 요청 검증·테스트 및 마이그레이션 스크립트를 반영했습니다.
공통코드 API도 `x-auth-key` 인증을 사용합니다. PATCH 본문은 `{ "CODE_VALUE": "007" }` 형식입니다.
기존 코드만 수정하며, 없는 코드는 404를 반환합니다. GET은 `USE_YN='Y'`인 코드만 반환합니다.
공통코드 테이블이 없는 환경에서는 `npm run db:migrate:common-code -- .env.dev`를 실행합니다.
운영 환경은 마지막 인자를 `.env.prod`로 바꾸세요. 이미 저장된 공통코드 값은 덮어쓰지 않습니다.

Swagger는 `/api/docs`에서 제공하며, 운영 소스의 상대 API 서버 경로를 적용해 HTTPS 프록시에서도
문서를 연 호스트/프로토콜로 요청합니다. RAG sync와 기존 시작 로그 경로 수정은 유지했습니다.
운영 실행 예: Linux에서 `NODE_ENV=production npm start`.

## RAG 문서 동기화

Linux에서 모델 컨테이너를 구성하는 방법은 [Linux Docker AI 서버 설치 가이드](./docs/linux-docker-ai.md)를 참고하세요.

### 페이지 검색 챗봇

`POST <API_PREFIX>/chat/messages`는 기존 `x-auth-key` 인증을 사용합니다.
질문은 최대 500자, 이전 대화는 user/assistant 역할 최대 6개·각 500자입니다.

```json
{
  "question": "Docker 네트워크 설정은 어디에 있어?",
  "mode": "auto",
  "history": []
}
```

요청의 mode는 `auto`(기본), `general`, `document`입니다. 자동 모드는 명시적인 페이지/문서/검색 요청을
문서 검색으로, 개념 질문·인사 등은 일반 질문으로 처리합니다. 애매하면 화면에서 직접 선택할 수 있습니다.
일반 질문은 DB/임베딩을 호출하지 않고 Qwen에 직접 전달합니다. 문서 검색 실패를 일반 지식으로 대체하지 않습니다.
검색 전용 `/chat/search`는 요청 mode와 관계없이 항상 문서 검색을 수행합니다.

응답은 `{ answer, sources, mode, intent, evidence?, generationUnavailable? }`이며 sources 항목은
`menuId`, `parentId`, `title`, `path`, `excerpt`, `score`, `similarity`를 포함합니다.
score와 similarity는 검색 점수이며 내용 존재 확률(%)이 아닙니다.
intent는 `general` 또는 `document`입니다. 일반 답변은 mode=`general`, 빈 sources이며 evidence는 없습니다.

`evidence.status`는 다음과 같이 구분합니다.

| 값 | 의미 | 동작 |
| --- | --- | --- |
| `supported` | 질문의 핵심 주제와 일치하고 모델 검사에서 실제 본문 인용을 확인 | 인용·답변·페이지 제공 |
| `partial` | 일부 주제만 관련되거나 답변 근거를 확인하지 못함 | 미확인 안내와 참고용 페이지 제공, 답변 생성 생략 |
| `insufficient` | 검색 후보 없음, 핵심 주제 불일치 또는 구체적 질문 부족 | 자료 부족 안내, 근거 없는 페이지·답변 미제공 |

모든 핵심 키워드가 함께 포함된 후보만 모델 검사를 진행합니다.
모델이 supported라고 해도 12자 이상의 인용이 원문 본문에 실제 존재하고 핵심 주제를 포함해야 인정합니다.
검사 응답 형식 오류·가짜 인용·검사 API 장애는 partial로 처리합니다.
응답에는 판단 이유, 일치/누락 키워드, 검사 상태, 확인된 인용도 포함됩니다.
`/chat/search`는 모델 검사를 하지 않아 supported를 확정하지 않습니다.
이 판정은 검색된 문서에 대한 보수적인 근거 수준이며 사이트 전체에 내용이 없음을 증명하지 않습니다.
동의어·다른 표현·문서 조각 분할 때문에 실제 내용이 있어도 partial/insufficient일 수 있습니다.
`POST <API_PREFIX>/chat/search`는 같은 입력으로 답변 생성 없이 페이지만 검색합니다.
API 계약은 Swagger의 Chat 항목에서도 확인할 수 있습니다.

E5 질문 prefix는 `query: `이며 문서 prefix `passage: `와 구분합니다.
현재 임베딩 모델의 DB 벡터만 로드하고 코사인 유사도·제목/본문 키워드로 정렬한 뒤,
동일 페이지는 하나로 묶어 최대 3개를 반환합니다. `RAG_MIN_SIMILARITY` 기본값은 0.78이며
키워드 일치가 없는 후보에 적용합니다. 실제 문서와 질문으로 임계값을 조정할 수 있습니다.
검색 인덱스는 프로세스 내 60초 캐시이며 같은 프로세스의 sync 커밋 성공 시 즉시 무효화합니다.
다른 프로세스/서버가 sync한 변경은 최대 60초 후 반영됩니다.

활성 환경변수 파일에 아래 항목을 설정합니다. 프론트에는 모델 키를 전달하지 않습니다.

```dotenv
CHAT_API_URL=http://127.0.0.1:18081/v1/chat/completions
CHAT_MODEL=qwen3-0.6b
CHAT_API_KEY=실제_대화서버_인증키
CHAT_TIMEOUT_MS=60000
RAG_MIN_SIMILARITY=0.78
```

검색 시 임베딩 서버가 실패하면 키워드 검색으로 대체합니다. 답변 생성 실패 또는
첫 페이지 제목을 포함하지 않는 모델 답변은 DB에서 조회한 페이지 목록으로 대체합니다 (supported인 경우).
문서 미적재 시 sync 안내를 반환하고, RAG 테이블 조회 실패 시 503입니다.
동시 챗봇 요청은 프로세스당 2개로 제한하고 초과 시 429를 반환합니다.
대화는 DB에 저장하지 않습니다. 후속 질문 검색은 현재 질문을 기준으로 하므로
"그 페이지" 같은 표현보다 기술명을 포함한 질문이 정확합니다.
작은 모델의 요약은 오류가 있을 수 있어 원문 카드도 함께 제공합니다.

실제 API 확인 (DB 수정 없음, Docker 문서가 sync되어 있어야 함):

```sh
node scripts/verify-chat.mjs http://127.0.0.1:3000/api
```

### multilingual-e5-small 서버 및 진행 로그

기본 임베딩 모델을 `intfloat/multilingual-e5-small`로 전환했습니다 (384차원).
`.env.dev`의 기존 API 키와 URL은 유지하고 모델명과 문서 prefix를 변경했습니다.
E5 GGUF는 llama.cpp 공식 서버 이미지의 별도 컨테이너로 실행합니다. Qwen 대화 컨테이너는 그대로 사용합니다.

```sh
docker logs -f e5-embedding
```

GGUF 파일이 있는 폴더를 `/models`로 마운트하고 `-m /models/multilingual-e5-small-q8_0.gguf`로 지정합니다.
서버 실행 옵션은 `--embedding --pooling mean --alias intfloat/multilingual-e5-small`을 사용합니다.
현재 사용하는 cstr Q8_0 GGUF에는 token type count 메타데이터가 누락되어 있으므로
`--override-kv tokenizer.ggml.token_type_count=int:2`도 추가합니다.
이 옵션이 없으면 `bert model needs to define token type count`로 서버가 종료됩니다.
또한 해당 파일은 SentencePiece unigram 어휘를 llama tokenizer로 표기하고 있어
`--override-kv tokenizer.ggml.model=str:t5`를 추가합니다. 모델 아키텍처는 BERT로 유지되며
토크나이저 구현만 unigram으로 선택합니다. 이 설정 없이 줄바꿈/탭이 포함된 Markdown을 보내면
`unordered_map::at` HTTP 500이 발생할 수 있습니다.
API 키는 `.env.dev`의 `EMBEDDING_API_KEY`와 동일하게 `--api-key`에 지정합니다.
같은 18082 포트를 쓰는 기존 Qwen 임베딩 컨테이너가 실행 중이면 먼저 중지해야 합니다.
기본 포트는 로컬 PC에서만 접근 가능하도록 `127.0.0.1:18082`에 바인딩합니다.
외부 서버에 설치할 때는 필요에 맞게 포트 바인딩과 백엔드의 URL을 변경하세요.

```dotenv
EMBEDDING_API_URL=http://127.0.0.1:18082/v1/embeddings
EMBEDDING_MODEL=intfloat/multilingual-e5-small
EMBEDDING_DOCUMENT_PREFIX="passage: "
RAG_CHUNK_SIZE=300
RAG_CHUNK_OVERLAP=50
```

백엔드 재시작 후 sync를 다시 호출하면 전체 문서 벡터가 E5로 교체됩니다.
기존 Qwen 벡터와 E5 질문 벡터는 섞어서 검색할 수 없습니다.
문서에는 `passage: `를 자동 적용하고 향후 질문 임베딩에는 `query: `를 사용합니다.
API는 정규화된 384차원 벡터를 반환합니다. 토큰 초과 413 또는 llama.cpp의
`input (... tokens) is too large to process` 오류는 sync가 해당 조각을 반으로 나눠 재시도합니다.
그 외 HTTP 오류는 sync 실패로 처리합니다. 모델의 512토큰 제한에 맞춰 조각 크기를 설정하세요.
재분할 시 전체 조각 수가 증가하므로 진행률/예상 시간은 조정될 수 있습니다.

sync 로그에는 탐색 완료 후 총 문서/조각 수, 요청 중인 문서 경로와 조각 번호,
벡터 완료 개수·퍼센트·경과 시간·잔여 예상 시간, DB 문서 저장 위치가 표시됩니다.
**임베딩 100%는 아직 DB 반영 완료가 아닙니다. `전체 완료 (DB 커밋 성공)`이 최종 성공입니다.**
실패 로그에도 마지막 처리 단계가 표시됩니다. 본문과 인증키는 로그에 남기지 않습니다.
개발 환경에서는 백엔드 콘솔, `SERVER_ENV=prod`에서는 `logs/server-YYYY-MM-DD.log`에서 확인합니다.
실제 임베딩 서버 검증은 `node scripts/verify-embedding.mjs .env.dev`로 실행할 수 있습니다
(인증, 벡터 차원·정규화 확인; DB 수정 없음).

Node.js 20 이상이 필요합니다 (`fetch`, `AbortSignal.timeout` 사용).

1. 기존 DB를 선택한 상태에서 `sql/001_joplin_rag.sql`을 실행합니다. 원본 덤프는 변경하지 않습니다.
   예: `mariadb -u USER -p DB_NAME < sql/001_joplin_rag.sql`
2. `.env.rag.example`의 항목을 실제 실행 환경인 `.env.dev`에 추가합니다. 기존 DB 및 JOPLIN_DIR/JOPLIN_HOST 설정은 그대로 필요합니다.
3. 별도의 임베딩 전용 모델 서버를 준비하고 `EMBEDDING_API_URL`을 전체 `/v1/embeddings` URL로 지정합니다.
   `EMBEDDING_MODEL`은 해당 서버의 모델 이름/alias입니다. 필요 시 Bearer 키를 `EMBEDDING_API_KEY`에 설정합니다.
   Qwen3 0.6B 대화 서버 주소를 그대로 쓰지 마세요. llama.cpp 임베딩 서버는 임베딩 모델을 로드하고
   `--embedding` 및 해당 모델에 맞는 pooling을 설정해야 합니다.
4. 기존 `GET <API_PREFIX>/sample/joplinSync`를 기존 `x-auth-key` 인증으로 호출합니다.
   성공 응답 `{ message, count }`의 count는 기존과 동일하게 폴더를 포함한 메뉴 수입니다.

저장 데이터:

| 테이블 | 내용 |
| --- | --- |
| `admin_menu` | 기존 페이지/폴더 메뉴와 상대 경로 |
| `joplin_document` | 메뉴 ID, 제목, 페이지 경로, Markdown 전문, 메타데이터/주석 제외 본문 |
| `joplin_document_chunk` | 조각 순서(0부터), 본문 조각, 임베딩 모델, 차원 수, JSON 벡터 |

E5용 환경변수 예제는 Unicode 문자 300자, 겹침 50자이며 환경변수로 변경할 수 있습니다 (미설정 시 기존 800/100).
문자 수는 토큰 수가 아니므로 사용하는 임베딩 모델의 토큰 제한에 맞게 조정하세요.
모델에서 요구하면 `EMBEDDING_DOCUMENT_PREFIX`를 지정합니다 (예: `passage: `).
향후 질문 검색에서도 같은 임베딩 모델/버전 및 그 모델에 맞는 질문 prefix를 사용해야 합니다.

MariaDB 10.11에는 네이티브 벡터 인덱스를 전제로 하지 않고 JSON 배열로 저장합니다.
챗봇 검색은 프로세스 메모리에서 벡터 유사도를 계산하며 `DOCUMENT_ID → MENU_ID → PATH`로 페이지를 연결합니다.

매 sync마다 벡터를 새로 생성하므로 문서가 많으면 오래 걸릴 수 있습니다.
같은 프로세스와 같은 DB에서 동시 sync를 차단하며 중복 요청은 409입니다.
임베딩 요청은 순차 실행하고 타임아웃/HTTP 오류/잘못된 벡터/차원 불일치 시 실패합니다.
벡터 생성 완료 후 메뉴·문서·조각을 전용 DB 연결의 단일 트랜잭션으로 교체하여
실패 시 기존 DB 데이터를 유지하고, 삭제된 문서의 벡터도 정리합니다.
빈 루트 폴더는 실수로 기존 DB를 비우지 않도록 실패 처리합니다.
메뉴 ID는 기존처럼 정렬 순서에서 파생되므로 파일 추가/삭제에 따라 변경될 수 있습니다.

정적 MD 제공을 위한 메타데이터 주석/이미지 경로 변경은 유지하며, 파일 쓰기를 완료한 뒤 DB를 교체합니다.
파일시스템은 DB 트랜잭션 대상이 아니므로 파일 변경 후 DB가 실패하면 파일 변경은 남을 수 있습니다.
반복 sync 시 본문과 이미 변환된 리소스 경로를 다시 손상시키지 않도록 처리했습니다.

로컬 검증: `npm test` (DB 및 외부 임베딩 서버 없이 문서 변환/분할/벡터 검증 단위 테스트).

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
