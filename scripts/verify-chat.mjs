import assert from 'node:assert/strict';
import dotenv from 'dotenv';

dotenv.config({ path: process.env.ENV_FILE || '.env.dev', quiet: true });
const base = process.argv[2] || `http://127.0.0.1:${process.env.SERVER_PORT || 3000}${process.env.API_PREFIX || '/api'}`;
const headers = { 'Content-Type': 'application/json', 'x-auth-key': process.env.AUTH_KEY };
async function post(path, body, auth = true) {
    const response = await fetch(base + path, { method: 'POST', headers: auth ? headers : { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(130000) });
    return { status: response.status, body: await response.json() };
}
assert.equal((await post('/chat/messages', { question: 'Docker' }, false)).status, 401);
assert.equal((await post('/chat/messages', { question: '' })).status, 400);
const request = { question: 'Docker 네트워크 설정은 어느 페이지에 있어?', history: [] };
const start = Date.now();
const search = await post('/chat/search', request);
assert.equal(search.status, 200);
assert.ok(search.body.sources.length > 0, 'Sync must contain Docker documents before this smoke test');
assert.equal(new Set(search.body.sources.map(source => source.menuId)).size, search.body.sources.length);
assert.ok(search.body.sources.every(source => source.parentId && /\.md$/i.test(source.path) && !('vector' in source)));
console.log(`검색 확인: ${Date.now() - start}ms, ${search.body.sources.length}개 페이지, ${search.body.mode}`);
const reply = await post('/chat/messages', request);
assert.equal(reply.status, 200);
assert.ok(reply.body.sources.length > 0);
assert.ok(['supported', 'partial', 'insufficient'].includes(reply.body.evidence?.status));
assert.ok(!reply.body.evidence.missingTerms.includes('어느'));
if (reply.body.evidence.status === 'supported') {
    assert.ok(reply.body.sources.some(source => reply.body.answer.includes(source.title)));
    assert.ok(reply.body.evidence.quote);
} else {
    assert.ok(reply.body.answer.includes('근거') || reply.body.answer.includes('확인되지'));
}
console.log(JSON.stringify({ answer: reply.body.answer, titles: reply.body.sources.map(source => source.title),
    mode: reply.body.mode, evidence: reply.body.evidence.status, generationUnavailable: reply.body.generationUnavailable }));
const missing = await post('/chat/messages', { question: 'Docker로 양자컴퓨터 제어하는 방법', mode: 'document', history: [] });
assert.equal(missing.status, 200);
assert.notEqual(missing.body.evidence.status, 'supported');
console.log(`부분 키워드만 일치하는 질문: ${missing.body.evidence.status}`);
const general = await post('/chat/messages', { question: 'Docker가 무엇인지 한 문장으로 설명해줘', mode: 'general', history: [] });
assert.equal(general.status, 200);
assert.equal(general.body.intent, 'general');
assert.equal(general.body.mode, 'general');
assert.deepEqual(general.body.sources, []);
assert.ok(general.body.answer);
assert.equal(general.body.evidence, undefined);
console.log('일반 질문 응답 및 문서 결과 미포함 확인');
console.log('챗봇 인증/입력 검증/검색/답변 API 확인 완료 (DB 수정 없음)');
