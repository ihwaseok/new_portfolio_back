import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { embeddingConfig, embedText } from '../src/service/embedding.js';

const loaded = dotenv.config({ path: process.argv[2] || '.env.dev', quiet: true });
if (loaded.error) throw new Error('환경설정 파일을 읽을 수 없습니다.');
const config = embeddingConfig();
const payload = { model: config.model, input: 'passage: 도커 컨테이너의 네트워크 설정 방법', encoding_format: 'float' };

const unauthorized = await fetch(config.url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(config.timeout) });
assert.equal(unauthorized.status, 401);

const started = performance.now();
const vector = await embedText('도커 컨테이너의 네트워크 설정 방법', config);
assert.equal(vector.length, 384);
assert.ok(Math.abs(Math.hypot(...vector) - 1) < 0.001, 'Vector must be normalized');
console.log(`인증/384차원/정규화 확인: ${Math.round(performance.now() - started)}ms`);

for (const text of ['첫 줄\n둘째 줄', '항목\t설명', '# 제목\n\n```js\nconst a = 1;\n```', '한글과 이모지 😀']) {
    const result = await embedText(text, config);
    assert.equal(result.length, 384);
    assert.ok(Math.abs(Math.hypot(...result) - 1) < 0.001);
}
console.log('줄바꿈/탭/Markdown 코드 블록/한글·이모지 임베딩 확인');
await assert.rejects(embedText('도커 네트워크 '.repeat(1000), config), error => error.status === 413);
console.log('토큰 초과 응답의 재분할 신호 확인');

