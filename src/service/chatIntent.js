export function resolveIntent(question, mode = 'auto', history = []) {
    if (mode === 'general' || mode === 'document') return mode;
    const documentRequest = text => /페이지|문서|노트|자료|사이트|메뉴|포트폴리오|검색|찾아|\b(pages?|documents?|notes?|site|portfolio|search|find)\b/i.test(text)
        || (/어디|어느|\bwhere\b/i.test(text) && /설정|정리|설명|코드|매뉴얼|\b(config|configuration|section)\b/i.test(text));
    if (documentRequest(question)) return 'document';
    // Short follow-ups retain a clearly expressed document-search intent.
    const previous = history.filter(turn => turn.role === 'user').at(-1)?.content || '';
    if (/^(그|이거|해당|더\s|좀\s*더|자세히|계속)/.test(question) && documentRequest(previous)) return 'document';
    return 'general';
}

export function generalMessages(question, history) {
    const generalHistory = [];
    let include = false;
    for (const turn of history) {
        if (turn.role === 'user') include = resolveIntent(turn.content, 'auto', history.slice(0, history.indexOf(turn))) === 'general';
        if (include) generalHistory.push(turn);
    }
    const recent = [];
    let budget = 600;
    for (const turn of generalHistory.slice(-4).reverse()) {
        if (budget <= 0) break;
        const content = Array.from(turn.content).slice(0, Math.min(200, budget)).join('');
        recent.unshift({ role: turn.role, content });
        budget -= Array.from(content).length;
    }
    return [
        { role: 'system', content: '한국어로 친절하고 명확하게 답하세요. 사용자의 일반 질문에 직접 답하고 필요한 경우 짧은 예시를 드세요. 모르는 것은 모른다고 하세요. 이 대화에서는 사이트 문서를 검색하지 않았으므로 문서나 페이지를 확인했다고 주장하지 마세요.' },
        ...recent,
        { role: 'user', content: question }
    ];
}
