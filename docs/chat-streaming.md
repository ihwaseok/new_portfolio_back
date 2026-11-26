# 챗봇 스트리밍 계약

프론트는 이 계약으로 본문을 즉시 표시하고 검색·검증·생성 대기 동안 회전 표시와 처리 단계를 안내합니다.

기존 `POST <API_PREFIX>/chat/messages`에 `Accept: text/event-stream`을 보내면
SSE 응답을 받습니다. JSON 본문과 `x-auth-key` 인증은 기존과 동일합니다.
Accept를 생략하면 기존 JSON 응답을 반환하며 `/chat/search`도 JSON을 유지합니다.

| 이벤트   | 데이터                                       | 의미                          |
| -------- | -------------------------------------------- | ----------------------------- |
| `status` | `{ "message": "문서를 검색하고 있습니다…" }` | 대기 중인 처리 단계           |
| `meta`   | `{ "intent": "general" }` 또는 `document`    | 일반 질문·문서 질문 구분      |
| `answer` | `{ "text": "지금까지 생성된 답변" }`         | 누적 본문. 덧붙이지 않고 교체 |
| `done`   | 기존 ChatResponse 전체                       | 최종 답변·출처·근거 상태 확정 |
| `error`  | `{ "message": "오류 안내" }`                 | 스트림 시작 후 발생한 오류    |

인증·입력 검증·동시 실행 제한 오류는 스트림을 시작하기 전에 기존 HTTP 오류로 반환합니다.
스트림 시작 후에는 HTTP 상태를 변경할 수 없으므로 error 이벤트로 오류를 전달합니다.
done 없이 연결이 끝나면 성공한 답변으로 취급하지 않습니다.

일반 대화는 모델 생성 시점부터 본문을 전송합니다. 문서 대화는 검색과 원문 인용 검증을
먼저 수행하며 이 구간에는 status 이벤트만 전송합니다. 모델 본문은 생성 중인 임시 답변이며,
완료 후 기존 제목 검증을 통과하지 못하거나 생성이 중단되면 done의 문서 목록 안내로 교체됩니다.
출처와 근거 배지는 done 이후에 표시합니다. 기존 근거 검증 정책은 유지합니다.

브라우저가 연결을 끊으면 진행 중인 모델·임베딩 HTTP 요청도 취소합니다.
응답은 15초마다 SSE 주석을 보내며 `X-Accel-Buffering: no`로 Nginx 버퍼링을 방지합니다.
프록시에서 이 헤더를 무시하지 않아야 하며, Nginx 등의 읽기 제한 시간도 모델 대기 시간에
맞아야 합니다. 스트리밍은 첫 본문을 보는 대기를 줄이며 추론 연산 자체를 빠르게 만들지는 않습니다.

```bash
curl -N http://127.0.0.1:3000/api/chat/messages \
  -H 'Accept: text/event-stream' \
  -H 'Content-Type: application/json' \
  -H 'x-auth-key: 실제_백엔드_키' \
  -d '{"question":"Docker에 대해 설명해줘","mode":"general","history":[]}'
```

## 로컬 검증

DB나 실제 모델 인증키 없이 기본 테스트를 실행할 수 있습니다.

```bash
npm test
```

실제 HTTP 모델 연동 경로까지 검사하려면 별도 터미널에서 모의 모델을 실행합니다.

```bash
postman simulation run postman/simulations/chat-stream.sim.yaml --port 19450 --no-history
```

다른 터미널에서 실행합니다. 아래는 Linux Bash 기준입니다.

```bash
STREAM_MOCK_URL=http://127.0.0.1:19450/model/v1/chat/completions npm test
```

모의 모델 검증은 서버의 인증·정상 SSE·HTTP 오류·중간 종료 처리를 확인하며 모델 품질이나
실제 라즈베리파이의 처리 속도를 보장하지 않습니다. 기본 테스트에는 모델이 완료되기 전에
본문이 HTTP 클라이언트에 도착하는지 확인하는 별도 로컬 서버 검사도 포함됩니다.
