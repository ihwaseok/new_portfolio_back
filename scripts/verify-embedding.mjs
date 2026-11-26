import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { embeddingConfig, embedText } from '../src/service/embedding.js';

// 선택한 환경파일에서 실제 임베딩 서버 설정을 불러옵니다.
const loaded = dotenv.config({ path: process.argv[2] || '.env.dev', quiet: true });
if (loaded.error) throw new Error('환경설정 파일을 읽을 수 없습니다.');
const config = embeddingConfig();
const payload = {
    model: config.model,
    input: 'passage: 도커 컨테이너의 네트워크 설정 방법',
    encoding_format: 'float',
};

// 인증 키가 없는 임베딩 요청이 거절되는지 확인합니다.
const unauthorized = await fetch(config.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(config.timeout),
});
assert.equal(unauthorized.status, 401);

// 벡터의 384차원·정규화 여부와 요청 소요 시간을 확인합니다.
const started = performance.now();
const vector = await embedText('도커 컨테이너의 네트워크 설정 방법', config);
assert.equal(vector.length, 384);
assert.ok(Math.abs(Math.hypot(...vector) - 1) < 0.001, 'Vector must be normalized');
console.log(`인증/384차원/정규화 확인: ${Math.round(performance.now() - started)}ms`);

// 줄바꿈·탭·코드 블록·한글과 이모지가 포함된 입력도 검증합니다.
for (const text of [
    '첫 줄\n둘째 줄',
    '항목\t설명',
    '# 제목\n\n```js\nconst a = 1;\n```',
    '한글과 이모지 😀',
]) {
    const result = await embedText(text, config);
    assert.equal(result.length, 384);
    assert.ok(Math.abs(Math.hypot(...result) - 1) < 0.001);
}
console.log('줄바꿈/탭/Markdown 코드 블록/한글·이모지 임베딩 확인');
// 입력 토큰 초과 오류가 재분할 신호인 413으로 변환되는지 확인합니다.
await assert.rejects(
    embedText('도커 네트워크 '.repeat(1000), config),
    (error) => error.status === 413,
);
console.log('토큰 초과 응답의 재분할 신호 확인');
