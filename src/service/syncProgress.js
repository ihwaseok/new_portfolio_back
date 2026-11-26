// 동기화 단계·경과 시간·잔여 예상 시간과 마지막 실패 위치를 기록합니다.
export function createSyncProgress(logger = global.Logger, now = Date.now) {
    const started = now();
    let position = '초기화';
    const elapsed = () => Math.max(0, (now() - started) / 1000);
    // 각 진행 메시지에 공통 접두어와 경과 시간을 붙입니다.
    function log(message) {
        logger?.info(`[Joplin Sync] ${message} | 경과 ${elapsed().toFixed(1)}초`);
    }
    return {
        // 현재 처리 단계를 저장하여 실패 시 마지막 위치를 추적합니다.
        stage(message) {
            position = message;
            log(message);
        },
        // 완료 조각 수를 기준으로 진행률과 임베딩 잔여 예상 시간을 계산합니다.
        embedding(done, total, documentNo, documentTotal, path, chunkNo, chunkTotal) {
            const remaining =
                done > 0
                    ? ` | 임베딩 잔여 예상 ${((elapsed() / done) * (total - done)).toFixed(0)}초`
                    : '';
            position = `임베딩 ${done}/${total} (${total ? ((done / total) * 100).toFixed(1) : '100.0'}%)`;
            log(
                `${position} | 문서 ${documentNo}/${documentTotal} | 조각 ${chunkNo}/${chunkTotal} | ${path}${remaining}`,
            );
        },
        // 실패한 단계와 경과 시간을 오류 메시지와 함께 남깁니다.
        fail(error) {
            logger?.error(
                `[Joplin Sync] 실패: ${position} | 경과 ${elapsed().toFixed(1)}초 | ${error.message}`,
            );
        },
    };
}
