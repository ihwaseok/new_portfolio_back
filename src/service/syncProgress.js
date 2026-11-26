export function createSyncProgress(logger = global.Logger, now = Date.now) {
    const started = now();
    let position = '초기화';
    const elapsed = () => Math.max(0, (now() - started) / 1000);
    function log(message) {
        logger?.info(`[Joplin Sync] ${message} | 경과 ${elapsed().toFixed(1)}초`);
    }
    return {
        stage(message) { position = message; log(message); },
        embedding(done, total, documentNo, documentTotal, path, chunkNo, chunkTotal) {
            const remaining = done > 0 ? ` | 임베딩 잔여 예상 ${((elapsed() / done) * (total - done)).toFixed(0)}초` : '';
            position = `임베딩 ${done}/${total} (${total ? (done / total * 100).toFixed(1) : '100.0'}%)`;
            log(`${position} | 문서 ${documentNo}/${documentTotal} | 조각 ${chunkNo}/${chunkTotal} | ${path}${remaining}`);
        },
        fail(error) { logger?.error(`[Joplin Sync] 실패: ${position} | 경과 ${elapsed().toFixed(1)}초 | ${error.message}`); }
    };
}
