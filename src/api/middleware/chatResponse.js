import { validateChat } from '../../service/ragSearch.js';

// JSON 호환 응답과 POST 기반 SSE를 함께 제공하고 두 경로의 동시 실행 수를 공유합니다.
export function createChatHandler(chat) {
    let active = 0;
    return async (req, res) => {
        let input;
        try {
            input = validateChat(req.body);
        } catch (error) {
            return res.status(400).json({ message: error.message });
        }
        if (active >= 2)
            return res
                .status(429)
                .json({ message: '다른 질문을 처리 중입니다. 잠시 후 다시 시도해 주세요.' });
        active++;
        const searchOnly = req.path === '/search';
        const streaming = !searchOnly && req.get('accept')?.includes('text/event-stream');
        const controller = new AbortController();
        const disconnect = () => {
            if (!res.writableEnded) controller.abort();
        };
        res.on('close', disconnect);
        let heartbeat;
        const send = (event, data) => {
            if (!res.destroyed && !res.writableEnded)
                res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };
        try {
            res.set('Cache-Control', 'no-store');
            if (streaming) {
                res.set({
                    'Content-Type': 'text/event-stream; charset=utf-8',
                    'X-Accel-Buffering': 'no',
                });
                res.flushHeaders();
                send('status', { message: '질문을 확인하고 있습니다…' });
                // 긴 검색·검증 중에도 프록시 연결을 유지합니다.
                heartbeat = setInterval(() => {
                    if (!res.destroyed) res.write(': keep-alive\n\n');
                }, 15000);
            }
            const result = await chat(input, searchOnly, {
                signal: controller.signal,
                ...(streaming
                    ? {
                          onText: (text) => send('answer', { text }),
                          onStatus: (message) => send('status', { message }),
                          onMeta: (meta) => send('meta', meta),
                      }
                    : {}),
            });
            if (controller.signal.aborted) return;
            if (streaming) {
                send('done', result);
                return res.end();
            }
            return res.json(result);
        } catch (error) {
            if (controller.signal.aborted || res.destroyed) return;
            global.Logger?.error(`[Chat] 요청 실패: ${error.code || error.name}`);
            const message =
                error.status === 503 ? error.message : '챗봇 처리 중 오류가 발생했습니다.';
            if (streaming) {
                send('error', { message });
                return res.end();
            }
            return res.status(error.status || 500).json({ message });
        } finally {
            clearInterval(heartbeat);
            res.off('close', disconnect);
            active--;
        }
    };
}
