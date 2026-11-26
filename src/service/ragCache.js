let revision = 0;
export function invalidateRagIndex() { revision++; }

export function createIndexCache(load, ttl = 60000) {
    let cached;
    let loading;
    return async function getIndex(model) {
        if (cached?.model === model && cached.revision === revision && Date.now() - cached.time < ttl) return cached.rows;
        if (loading?.model === model && loading.revision === revision) return loading.promise;
        const current = revision;
        const promise = load(model).then(rows => {
            if (current === revision) cached = { model, rows, revision: current, time: Date.now() };
            return current === revision ? rows : getIndex(model);
        }).finally(() => { if (loading?.promise === promise) loading = null; });
        loading = { model, revision: current, promise };
        return promise;
    };
}
