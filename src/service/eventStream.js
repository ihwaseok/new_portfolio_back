// TCP 청크와 UTF-8 문자 경계에 관계없이 SSE 이벤트를 한 건씩 읽습니다.
export async function* readEvents(body) {
    if (!body) throw new Error('스트리밍 응답 본문이 없습니다.');
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let lines = [];
    const event = () => {
        const data = lines
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).replace(/^ /, ''))
            .join('\n');
        lines = [];
        return data;
    };
    try {
        while (true) {
            const { value, done } = await reader.read();
            buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
            let end;
            while ((end = buffer.indexOf('\n')) !== -1) {
                const line = buffer.slice(0, end).replace(/\r$/, '');
                buffer = buffer.slice(end + 1);
                if (line === '') {
                    const data = event();
                    if (data) yield data;
                } else lines.push(line);
            }
            if (done) {
                if (buffer) lines.push(buffer.replace(/\r$/, ''));
                const data = event();
                if (data) yield data;
                break;
            }
        }
    } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
    }
}

// 청크 사이에 나뉜 think 태그와 미완료 추론 본문이 화면에 노출되지 않게 합니다.
export function visibleAnswer(text, complete = false) {
    let visible = text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<think>[\s\S]*$/, '');
    if (!complete) {
        for (let length = 1; length < '<think>'.length; length++) {
            if (visible.endsWith('<think>'.slice(0, length))) {
                visible = visible.slice(0, -length);
                break;
            }
        }
    }
    return visible.trim().slice(0, 4000);
}
