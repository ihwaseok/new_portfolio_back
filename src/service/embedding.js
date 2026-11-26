// 임베딩 API 설정을 검증하고 E5 모델의 문서 접두어와 384차원을 적용합니다.
export function embeddingConfig(env = process.env) {
    if (!env.EMBEDDING_API_URL || !env.EMBEDDING_MODEL) {
        throw new Error(
            'EMBEDDING_API_URL 및 EMBEDDING_MODEL을 설정하세요. 대화 모델과 별도의 임베딩 API가 필요합니다.',
        );
    }
    const url = new URL(env.EMBEDDING_API_URL);
    if (!['http:', 'https:'].includes(url.protocol))
        throw new Error('임베딩 API URL은 HTTP(S)여야 합니다.');
    const timeout = Number(env.EMBEDDING_TIMEOUT_MS || 60000);
    if (!Number.isInteger(timeout) || timeout < 1)
        throw new Error('EMBEDDING_TIMEOUT_MS 설정이 잘못되었습니다.');
    const isE5 = env.EMBEDDING_MODEL === 'intfloat/multilingual-e5-small';
    return {
        url: url.href,
        model: env.EMBEDDING_MODEL,
        key: env.EMBEDDING_API_KEY,
        timeout,
        prefix: isE5 ? 'passage: ' : env.EMBEDDING_DOCUMENT_PREFIX || '',
        dimension: isE5 ? 384 : undefined,
    };
}

// 인증과 시간 제한을 적용해 벡터를 요청하고 응답 값과 차원을 검증합니다.
export async function embedText(text, config, fetchImpl = fetch) {
    let response;
    try {
        response = await fetchImpl(config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(config.key ? { Authorization: `Bearer ${config.key}` } : {}),
            },
            body: JSON.stringify({
                model: config.model,
                input: config.prefix + text,
                encoding_format: 'float',
            }),
            signal: config.signal
                ? AbortSignal.any([config.signal, AbortSignal.timeout(config.timeout)])
                : AbortSignal.timeout(config.timeout),
        });
    } catch (error) {
        const causes = error.cause?.errors || [error.cause || error];
        const codes = [
            ...new Set(causes.map((cause) => cause.code || cause.name).filter(Boolean)),
        ].join(', ');
        const target = new URL(config.url);
        throw new Error(
            `임베딩 API 연결 실패: ${target.origin}${target.pathname} (${codes || 'network error'}). 컨테이너 실행 상태와 포트/주소를 확인하세요.`,
            { cause: error },
        );
    }
    if (!response.ok) {
        let failure;
        try {
            failure = await response.json?.();
        } catch {
            /* 외부 오류 응답이 JSON이 아니어도 HTTP 상태 코드는 유지합니다. */
        }
        const message = failure?.error?.message || '';
        // 일부 llama.cpp 버전은 입력 토큰 제한 초과를 HTTP 500으로 반환하므로 별도로 판별합니다.
        const tooLong =
            response.status === 413 ||
            failure?.error?.type === 'exceed_context_size_error' ||
            /input \(\d+ tokens\) is too large to process/i.test(message);
        const detail = tooLong
            ? '입력 토큰 제한 초과: 조각 재분할 필요'
            : message.includes('unordered_map::at')
              ? '모델 토크나이저 오류: unordered_map::at'
              : '';
        throw Object.assign(
            new Error(
                `임베딩 API 요청 실패 (HTTP ${response.status})${detail ? ` | ${detail}` : ''}`,
            ),
            { status: tooLong ? 413 : response.status },
        );
    }
    const body = await response.json();
    const vector = body.data?.[0]?.embedding;
    if (
        !Array.isArray(vector) ||
        !vector.length ||
        !vector.every((v) => typeof v === 'number' && Number.isFinite(v)) ||
        !vector.some((v) => v !== 0)
    ) {
        throw new Error('임베딩 API가 유효한 벡터를 반환하지 않았습니다.');
    }
    if (config.dimension && vector.length !== config.dimension) {
        throw new Error(
            `임베딩 모델 차원 오류: ${config.model}은 ${config.dimension}차원이어야 하지만 ${vector.length}차원이 반환됐습니다. 서버의 실제 모델을 확인하세요.`,
        );
    }
    return vector;
}
