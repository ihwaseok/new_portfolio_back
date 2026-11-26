import { embedText, embeddingConfig } from './embedding.js';
import { rankDocuments, publicSources, buildMessages } from './ragSearch.js';
import { assessEvidence, evidenceMessages, parseEvidence } from './ragEvidence.js';
import { resolveIntent, generalMessages } from './chatIntent.js';

export async function generateAnswer(messages, env = process.env, fetchImpl = fetch) {
    const url = new URL(env.CHAT_API_URL || 'http://127.0.0.1:18081/v1/chat/completions');
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('CHAT_API_URL은 HTTP(S) 주소여야 합니다.');
    const timeout = Number(env.CHAT_TIMEOUT_MS || 60000);
    const response = await fetchImpl(url, { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(env.CHAT_API_KEY ? { Authorization: `Bearer ${env.CHAT_API_KEY}` } : {}) },
        body: JSON.stringify({ model: env.CHAT_MODEL || 'qwen3-0.6b', messages, max_tokens: 256,
            temperature: 0.2, stream: false }), signal: AbortSignal.timeout(timeout) });
    if (!response.ok) throw new Error(`답변 API HTTP ${response.status}`);
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new Error('모델 답변이 비어 있습니다.');
    return content.replace(/<think>[\s\S]*?<\/think>/g, '').trim().slice(0, 4000);
}

// Dependencies are injectable for unit tests; production uses actual DB and model APIs.
export function createChatService({ index, embed = embedText, answer = generateAnswer,
    verify = (question, sources, env) => generateAnswer(evidenceMessages(question, sources), env),
    env = process.env, logger = () => global.Logger } = {}) {
    const documentChat = async ({ question, history = [] }, searchOnly = false) => {
        const model = env.EMBEDDING_MODEL || 'intfloat/multilingual-e5-small';
        let rows;
        try { rows = await index(model); } catch (error) {
            logger()?.error(`[Chat] 문서 인덱스 조회 실패: ${error.code || error.name}`);
            throw Object.assign(new Error('검색 데이터를 읽을 수 없습니다. RAG 테이블과 sync 상태를 확인하세요.'), { status: 503 });
        }
        if (!rows.length) return { answer: '검색할 문서가 없습니다. 현재 임베딩 모델로 sync를 먼저 완료해 주세요.', sources: [], mode: 'empty',
            evidence: { status: 'insufficient', reason: '문서가 아직 적재되지 않았습니다.', matchedTerms: [], missingTerms: [], verification: 'not_needed' } };
        let vector;
        let mode = 'hybrid';
        try {
            const config = embeddingConfig(env);
            // Documents use passage:, questions must use query:.
            vector = await embed(question, { ...config, prefix: model === 'intfloat/multilingual-e5-small' ? 'query: ' : (env.EMBEDDING_QUERY_PREFIX || '') });
        } catch (error) {
            mode = 'keyword';
            logger()?.warning?.(`[Chat] 질문 임베딩 실패, 키워드 검색 사용: ${error.name}`);
        }
        const configured = Number(env.RAG_MIN_SIMILARITY ?? 0.78);
        const minSimilarity = Number.isFinite(configured) && configured >= 0 && configured <= 1 ? configured : 0.78;
        const matches = rankDocuments(rows, question, vector, { minSimilarity });
        let sources = publicSources(matches);
        const assessment = assessEvidence(question, matches);
        const { candidates = [], ...evidence } = assessment;
        if (evidence.status === 'insufficient') return { answer: evidence.reason, sources: [], mode, evidence };
        // Search-only returns conservative retrieval evidence without calling the answer model.
        if (searchOnly) return { sources, mode, evidence };
        if (candidates.length) {
            try {
                const checked = parseEvidence(await verify(question, candidates, env), candidates, question);
                evidence.verification = 'verified';
                if (checked.supported) {
                    evidence.status = 'supported';
                    evidence.reason = '질문의 핵심 주제와 일치하며, 문서 본문에서 답변 근거를 확인했습니다.';
                    evidence.quote = checked.quote;
                    // The verified document must be the primary citation and generation context.
                    const ordered = [checked.source, ...matches.filter(source => source.menuId !== checked.source.menuId)];
                    matches.splice(0, matches.length, ...ordered);
                    sources = publicSources(matches);
                }
            } catch (error) {
                evidence.verification = 'unavailable';
                evidence.reason = '관련 문서는 찾았지만 답변 근거 확인을 완료하지 못했습니다.';
                logger()?.warning?.(`[Chat] 근거 확인 실패: ${error.name}`);
            }
        }
        if (evidence.status !== 'supported') return {
            answer: evidence.missingTerms.length
                ? `관련 문서는 있지만, 질문한 내용 전체는 확인되지 않았습니다. 특히 ‘${evidence.missingTerms.join(', ')}’에 대한 근거가 부족합니다. 아래 페이지는 참고 자료입니다.`
                : evidence.reason + ' 아래 페이지는 참고 자료입니다.',
            sources, mode, evidence
        };
        const fallback = `다음 페이지에서 관련 내용을 확인할 수 있습니다.\n${sources.map((source, i) => `${i + 1}. ${source.title}`).join('\n')}`;
        try {
            const generated = await answer(buildMessages(question, history, matches), env);
            if (typeof generated !== 'string' || !generated.includes(matches[0].title) || generated.includes('「페이지 제목」')) {
                throw new Error('모델 답변에 검색된 페이지 제목이 없습니다.');
            }
            return { answer: generated, sources, mode, evidence };
        } catch (error) {
            logger()?.warning?.(`[Chat] 답변 생성 실패, 검색 결과 반환: ${error.name}`);
            return { answer: fallback, sources, mode, evidence, generationUnavailable: true };
        }
    };
    return async (input, searchOnly = false) => {
        const intent = searchOnly ? 'document' : resolveIntent(input.question, input.mode, input.history || []);
        if (intent === 'general') {
            try {
                const generated = await answer(generalMessages(input.question, input.history || []), env);
                if (typeof generated !== 'string' || !generated.trim()) throw new Error('빈 일반 답변');
                return { answer: generated, sources: [], mode: 'general', intent: 'general' };
            } catch (error) {
                logger()?.warning?.(`[Chat] 일반 답변 생성 실패: ${error.name}`);
                throw Object.assign(new Error('일반 답변을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.'), { status: 503 });
            }
        }
        return { ...await documentChat(input, searchOnly), intent: 'document' };
    };
}

