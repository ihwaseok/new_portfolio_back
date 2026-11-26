# Linux Docker에서 Qwen 대화·E5 임베딩 서버 실행

이 문서는 `new_portfolio_back`의 챗봇에 사용하는 두 모델 서버를 Linux에서 실행하는 방법입니다.
명령은 **Linux Bash** 기준이며 Windows CMD의 `^` 대신 줄 끝에 `\`를 사용합니다.

| 컨테이너       | 모델                       | 역할                         | 호스트 포트 | API                    |
| -------------- | -------------------------- | ---------------------------- | ----------- | ---------------------- |
| `qwen-api`     | Qwen3-0.6B Q4_K_M          | 일반 대화·RAG 답변·근거 검사 | 18081       | `/v1/chat/completions` |
| `e5-embedding` | multilingual-e5-small Q8_0 | 문서·질문 임베딩             | 18082       | `/v1/embeddings`       |

두 컨테이너 모두 `ghcr.io/ggml-org/llama.cpp:server` 이미지를 사용합니다.
모델은 `/home/models`에 저장하고 컨테이너의 `/models`로 읽기 전용 연결합니다.
컨테이너 내부 포트는 둘 다 8080이며 호스트 포트가 달라 동시에 실행할 수 있습니다.
CPU 실행 구성으로 별도 GPU는 필요하지 않습니다.

## 1. 실행 환경 확인

Docker Engine이 설치되어 실행 중이고, 현재 사용자에게 Docker 실행 권한이 있어야 합니다.
아래 예제에는 `curl`, `openssl`도 필요합니다.

```bash
docker version
uname -m
getconf LONG_BIT
```

64비트 Linux를 사용하세요. 공식 서버 이미지는 `linux/amd64`와 `linux/arm64`를 제공합니다.
Raspberry Pi에서는 64비트 OS와 Docker를 사용하고, 두 모델을 함께 실행할 메모리 여유를 확인하세요.
이 프로젝트에서 실제 API 호출을 검증한 환경은 Windows Docker Desktop의 Linux 컨테이너입니다.
Linux 서버와 Raspberry Pi에서의 응답 속도는 장비에서 별도로 확인해야 합니다.

## 2. 모델 다운로드

```bash
sudo mkdir -p /home/models

sudo curl -fL --retry 3 \
  -o /home/models/Qwen3-0.6B-Q4_K_M.gguf \
  'https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q4_K_M.gguf'

sudo curl -fL --retry 3 \
  -o /home/models/multilingual-e5-small-q8_0.gguf \
  'https://huggingface.co/cstr/multilingual-e5-small-GGUF/resolve/main/multilingual-e5-small-q8_0.gguf'

sudo chmod 644 /home/models/*.gguf
ls -lh /home/models/*.gguf
```

다운로드 출처는 각각 [Unsloth Qwen3 GGUF](https://huggingface.co/unsloth/Qwen3-0.6B-GGUF)와
[cstr E5 GGUF](https://huggingface.co/cstr/multilingual-e5-small-GGUF)입니다.
둘 다 원본 모델을 GGUF로 변환한 커뮤니티 배포 파일입니다.
Qwen **대화 모델**과 Qwen **임베딩 모델**을 혼동하지 마세요. 이 구성의 임베딩 모델은 E5입니다.

## 3. 인증키 준비

각 모델 서버의 인증키를 저장합니다. 기존 파일이 있으면 키를 다시 생성하지 않습니다.
같은 Bash 터미널에서 이어서 실행하세요.

```bash
AI_CONFIG_DIR="$HOME/.config/portfolio-ai"
mkdir -p "$AI_CONFIG_DIR"
chmod 700 "$AI_CONFIG_DIR"

if [ ! -f "$AI_CONFIG_DIR/qwen-api.env" ]; then
  (umask 077; printf 'LLAMA_API_KEY=%s\n' "$(openssl rand -hex 32)" \
    > "$AI_CONFIG_DIR/qwen-api.env")
fi

if [ ! -f "$AI_CONFIG_DIR/e5-embedding.env" ]; then
  (umask 077; printf 'LLAMA_API_KEY=%s\n' "$(openssl rand -hex 32)" \
    > "$AI_CONFIG_DIR/e5-embedding.env")
fi
```

llama.cpp는 `LLAMA_API_KEY` 환경변수로 인증키를 받습니다. 이 값은 외부 서비스가 발급하는 키가 아니라
직접 관리하는 모델 서버 접속키입니다. 키 파일을 Git 저장소에 넣지 마세요.
터미널을 새로 열었다면 `AI_CONFIG_DIR="$HOME/.config/portfolio-ai"`를 다시 지정합니다.
사용자를 변경하거나 `sudo -i`로 진입하면 `$HOME`도 달라지므로 같은 키 파일 위치를 사용하세요.

## 4. 이미지와 Docker 네트워크 준비

```bash
docker pull ghcr.io/ggml-org/llama.cpp:server

docker network inspect portfolio-ai >/dev/null 2>&1 \
  || docker network create portfolio-ai
```

네트워크 이름은 `portfolio-ai`입니다. 백엔드를 별도 컨테이너로 실행할 경우 같은 네트워크에서 모델 이름으로 접근할 수 있습니다.

## 5. Qwen 대화 서버 생성

`qwen-api`가 이미 있다면 아래 명령으로 제거한 후 다시 생성합니다.
컨테이너 제거는 모델 파일이나 DB를 삭제하지 않지만, 실행 중인 모델 요청은 중단됩니다.

```bash
docker rm -f qwen-api
```

처음 생성하는 경우 `No such container`는 무시하고 진행합니다.

```bash
docker run -d \
  --name qwen-api \
  --restart unless-stopped \
  --network portfolio-ai \
  -p 127.0.0.1:18081:8080 \
  --mount type=bind,source=/home/models,target=/models,readonly \
  --env-file "$AI_CONFIG_DIR/qwen-api.env" \
  ghcr.io/ggml-org/llama.cpp:server \
  -m /models/Qwen3-0.6B-Q4_K_M.gguf \
  --alias qwen3-0.6b \
  --host 0.0.0.0 \
  --port 8080 \
  -t 4 \
  -c 2048 \
  -np 1 \
  --reasoning off
```

## 6. E5 임베딩 서버 생성

기존 `e5-embedding` 또는 이전 모델의 `qwen-embedding`이 있다면 제거합니다.
존재하지 않는 컨테이너의 `No such container`는 무시합니다.

```bash
docker rm -f e5-embedding
docker rm -f qwen-embedding
```

```bash
docker run -d \
  --name e5-embedding \
  --restart unless-stopped \
  --network portfolio-ai \
  -p 127.0.0.1:18082:8080 \
  --mount type=bind,source=/home/models,target=/models,readonly \
  --env-file "$AI_CONFIG_DIR/e5-embedding.env" \
  ghcr.io/ggml-org/llama.cpp:server \
  -m /models/multilingual-e5-small-q8_0.gguf \
  --alias intfloat/multilingual-e5-small \
  --host 0.0.0.0 \
  --port 8080 \
  -t 4 \
  -c 512 \
  -b 512 \
  -ub 512 \
  -np 1 \
  --embedding \
  --pooling mean \
  --override-kv tokenizer.ggml.token_type_count=int:2 \
  --override-kv tokenizer.ggml.model=str:t5
```

**위 두 `--override-kv` 옵션은 현재 사용 중인 cstr GGUF에 필요합니다.**

- `token_type_count=int:2`: 누락된 BERT token type count 메타데이터 보완
- `model=str:t5`: SentencePiece unigram 어휘에 맞는 토크나이저 선택. 신경망 모델은 BERT로 유지됨

옵션이 없으면 각각 `bert model needs to define token type count` 로딩 오류나,
줄바꿈·탭이 포함된 입력의 `unordered_map::at` HTTP 500 오류가 발생할 수 있습니다.
다른 GGUF 파일로 교체할 경우 같은 보완 옵션을 무조건 적용하지 말고 해당 파일과의 호환성을 검증하세요.

E5는 384차원 벡터를 반환하고, 문서에는 `passage: `, 질문에는 `query: ` prefix를 사용합니다.
입력 한도는 512토큰입니다. 현재 백엔드는 토큰 초과 오류를 인식하면 문서 조각을 재분할합니다.

## 7. 실행 상태와 로그 확인

```bash
docker ps -a --filter name=qwen-api --filter name=e5-embedding

docker logs --tail 50 qwen-api
docker logs --tail 50 e5-embedding

curl -f http://127.0.0.1:18081/health
curl -f http://127.0.0.1:18082/health
```

모델 로딩 후 `model loaded`, `listening on http://0.0.0.0:8080` 로그와 정상 health 응답을 확인합니다.
두 컨테이너의 내부 포트가 8080인 것은 정상입니다.
실시간 로그는 `docker logs -f e5-embedding`처럼 확인하고, `Ctrl+C`로 로그 보기를 종료합니다.
로그 보기 종료는 컨테이너를 중지하지 않습니다.

## 8. 실제 API 테스트

### 대화 API

```bash
QWEN_API_KEY="$(sed -n 's/^LLAMA_API_KEY=//p' "$AI_CONFIG_DIR/qwen-api.env")"

curl -f http://127.0.0.1:18081/v1/chat/completions \
  -H "Authorization: Bearer $QWEN_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen3-0.6b",
    "messages": [
      {"role": "system", "content": "한국어로 짧게 답하세요."},
      {"role": "user", "content": "Docker가 무엇인지 한 문장으로 설명해줘."}
    ],
    "max_tokens": 128,
    "stream": false
  }'
```

응답의 `choices[0].message.content`가 답변입니다.

### 임베딩 API

```bash
E5_API_KEY="$(sed -n 's/^LLAMA_API_KEY=//p' "$AI_CONFIG_DIR/e5-embedding.env")"

curl -f http://127.0.0.1:18082/v1/embeddings \
  -H "Authorization: Bearer $E5_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "intfloat/multilingual-e5-small",
    "input": "passage: 첫 줄\n둘째 줄\t코드와 표가 있는 문서",
    "encoding_format": "float"
  }'
```

응답의 `data[0].embedding`에 숫자 384개가 반환되는지 확인합니다.
줄바꿈과 탭을 포함해 테스트하여 토크나이저 호환성도 함께 확인합니다.

## 9. 백엔드 환경변수 설정

백엔드를 **동일 Linux 호스트에서 Node.js로 직접 실행**한다면 활성 환경변수 파일에 다음을 설정합니다.
`CHAT_API_KEY`에는 qwen-api.env의 값, `EMBEDDING_API_KEY`에는 e5-embedding.env의 값을 각각 넣습니다.
`LLAMA_API_KEY=` 부분은 제외하고 키 값만 복사하세요.

```bash
# 실제 키 확인: 출력값을 해당 백엔드 환경변수에 설정
sed -n 's/^LLAMA_API_KEY=//p' "$AI_CONFIG_DIR/qwen-api.env"
sed -n 's/^LLAMA_API_KEY=//p' "$AI_CONFIG_DIR/e5-embedding.env"
```

```dotenv
CHAT_API_URL=http://127.0.0.1:18081/v1/chat/completions
CHAT_MODEL=qwen3-0.6b
CHAT_API_KEY=대화서버의_실제_키
CHAT_TIMEOUT_MS=60000

EMBEDDING_API_URL=http://127.0.0.1:18082/v1/embeddings
EMBEDDING_MODEL=intfloat/multilingual-e5-small
EMBEDDING_API_KEY=임베딩서버의_실제_키
EMBEDDING_TIMEOUT_MS=60000
EMBEDDING_DOCUMENT_PREFIX="passage: "
RAG_CHUNK_SIZE=300
RAG_CHUNK_OVERLAP=50
RAG_MIN_SIMILARITY=0.78
```

현재 `app.js`는 개발 시 `.env.dev`, `NODE_ENV=production`이면 `.env.prod`를 읽습니다.
`ENV_FILE`로 파일을 직접 지정할 수도 있습니다. 운영 환경변수를 수정한 뒤 백엔드를 재시작하세요.

### 백엔드도 Docker 컨테이너인 경우

백엔드 컨테이너의 `127.0.0.1`은 그 백엔드 컨테이너 자신이므로 모델 서버에 연결되지 않습니다.
백엔드도 `portfolio-ai` 네트워크에 연결합니다. 아래 `BACKEND_CONTAINER`는 실제 이름으로 변경하세요.

```bash
docker network connect portfolio-ai BACKEND_CONTAINER
```

이미 연결된 경우에는 추가 연결할 필요가 없습니다. 백엔드의 모델 주소는 다음과 같이 지정합니다.

```dotenv
CHAT_API_URL=http://qwen-api:8080/v1/chat/completions
EMBEDDING_API_URL=http://e5-embedding:8080/v1/embeddings
```

이때 컨테이너 사이에는 **8080**을 사용합니다. 18081/18082는 호스트에서 접근하는 포트입니다.

### 다른 PC의 Postman에서 테스트할 경우

위 명령은 로컬 접근용으로 `127.0.0.1`에만 포트를 공개합니다.
SSH 터널을 열면 포트 공개 범위를 바꾸지 않고 PC의 Postman에서 테스트할 수 있습니다.

```bash
ssh -N -L 18081:127.0.0.1:18081 -L 18082:127.0.0.1:18082 USER@SERVER_IP
```

PC에서 `http://localhost:18081/v1/chat/completions` 또는
`http://localhost:18082/v1/embeddings`를 호출하고 Authorization은 **Bearer Token**으로 설정합니다.
PC의 같은 포트를 이미 사용 중이면 터널의 왼쪽 포트만 다른 번호로 변경하세요.

## 10. 백엔드 검증 및 sync

백엔드 프로젝트 폴더에서 실행합니다.

```bash
node scripts/verify-embedding.mjs .env.prod

# 운영 실행 예시
NODE_ENV=production npm start
```

임베딩 검증은 인증, 384차원 벡터, 정규화, 줄바꿈·탭·코드 블록 및 토큰 초과 처리를 확인하며 DB를 수정하지 않습니다.
기존 DB에 `sql/001_joplin_rag.sql`이 적용되어 있어야 문서 sync와 RAG 검색을 사용할 수 있습니다.
Swagger의 `GET <API_PREFIX>/sample/joplinSync`를 호출하고, 백엔드 로그에서
**`전체 완료 (DB 커밋 성공)`**을 확인합니다. API 인증은 모델 키가 아닌 백엔드의 `AUTH_KEY`를 `x-auth-key` 헤더로 보냅니다.
이미 같은 E5 모델 파일과 설정으로 sync를 완료한 DB라면 컨테이너 재생성만으로 다시 sync할 필요는 없습니다.
임베딩 모델/양자화 파일/토크나이저 설정을 변경했다면 문서 벡터를 다시 생성하세요.

## 11. 재시작과 문제 해결

```bash
docker restart qwen-api e5-embedding
docker stats --no-stream qwen-api e5-embedding
docker inspect qwen-api e5-embedding \
  --format '{{.Name}} status={{.State.Status}} OOMKilled={{.State.OOMKilled}}'
```

`--restart unless-stopped`는 Docker가 다시 시작될 때 컨테이너도 재시작하도록 합니다.
직접 `docker stop`한 컨테이너는 `docker start`로 다시 시작하세요.

| 증상                                          | 확인할 사항                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| `failed to open GGUF file`                    | 호스트 파일 존재 여부, `/home/models` 마운트, `-m /models/...` 경로      |
| `unknown flag: --api-key`                     | llama.cpp 옵션은 Docker 이미지 이름 **뒤**에 지정                        |
| `port is already allocated`                   | 같은 호스트 포트 사용 여부. 기존 임베딩 컨테이너 중지/제거               |
| `bert model needs to define token type count` | E5의 token_type_count 보완 옵션                                          |
| `unordered_map::at`                           | 현재 E5 파일의 `tokenizer.ggml.model=str:t5` 보완 옵션                   |
| 입력 토큰 초과 HTTP 500/413                   | 512토큰 제한, 문서 조각 크기와 백엔드 자동 재분할 처리                   |
| `401 Invalid API Key`                         | 컨테이너 LLAMA_API_KEY와 백엔드/Postman의 Bearer 키 일치 여부            |
| 백엔드 `ECONNREFUSED`                         | 컨테이너가 정상 실행 중인지, 백엔드 위치에 맞는 URL인지                  |
| `OOMKilled=true`                              | RAM/다른 서비스 메모리 사용량 확인. 모델의 입력 길이·동시 요청 축소 검토 |

Docker 실행 옵션을 바꿀 때는 `docker restart`만으로 적용되지 않습니다. 기존 컨테이너를 제거하고 새 옵션으로 생성하세요.
운영에서 검증을 마친 뒤에는 이미지의 `server` 태그 대신 검증한 이미지 digest를 기록해 고정하면 재현에 도움이 됩니다.

## 참고

- [llama.cpp 공식 Docker 문서](https://github.com/ggml-org/llama.cpp/blob/master/docs/docker.md)
- [llama-server API 및 옵션](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)
- [E5 원본 모델 및 prefix 규칙](https://huggingface.co/intfloat/multilingual-e5-small)
