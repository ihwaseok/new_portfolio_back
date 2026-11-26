// 동기화 전후의 캐시 세대를 구분하여 오래된 조회 결과의 재등록을 막습니다.
let revision = 0;
// 동기화 커밋이 끝나면 캐시 세대를 변경하여 다음 조회부터 다시 적재합니다.
export function invalidateRagIndex() {
    revision++;
}

// 모델·유효기간·캐시 세대를 기준으로 인덱스를 재사용하고 동시 적재 요청을 공유합니다.
export function createIndexCache(load, ttl = 60000) {
    let cached;
    let loading;
    return async function getIndex(model) {
        if (
            cached?.model === model &&
            cached.revision === revision &&
            Date.now() - cached.time < ttl
        )
            return cached.rows;
        if (loading?.model === model && loading.revision === revision) return loading.promise;
        const current = revision;
        const promise = load(model)
            .then((rows) => {
                if (current === revision)
                    cached = { model, rows, revision: current, time: Date.now() };
                return current === revision ? rows : getIndex(model);
            })
            .finally(() => {
                if (loading?.promise === promise) loading = null;
            });
        loading = { model, revision: current, promise };
        return promise;
    };
}
