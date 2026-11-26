import Fs from 'node:fs/promises';
import Path from 'node:path';

// 코드를 포함한 본문은 보존하고 내보내기 메타데이터와 HTML 주석만 제거합니다.
export function documentText(markdown) {
    return markdown
        .replace(/^\uFEFF/, '')
        .replace(/\r\n?/g, '\n')
        .replace(/^---\n[\s\S]*?\n---(?:\n|$)/, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .trim();
}

// 유니코드 문자를 보존하면서 지정한 길이와 겹침 크기로 본문을 분할합니다.
export function splitChunks(text, size = 800, overlap = 100) {
    if (
        !Number.isInteger(size) ||
        !Number.isInteger(overlap) ||
        size < 1 ||
        overlap < 0 ||
        overlap >= size
    ) {
        throw new Error('RAG chunk size/overlap 설정이 잘못되었습니다.');
    }
    const chars = Array.from(text);
    const chunks = [];
    for (let start = 0; start < chars.length; start += size - overlap) {
        const chunk = chars
            .slice(start, start + size)
            .join('')
            .trim();
        if (chunk) chunks.push(chunk);
        if (start + size >= chars.length) break;
    }
    return chunks;
}

// 내보내기 메타데이터를 주석으로 바꾸고 리소스 링크를 정적 서버 경로로 변환합니다.
export function resourceContent(markdown, host) {
    let content = markdown.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    content = content.replace(
        /^---\n([\s\S]*?)\n---(?=\n|$)/,
        (_, metadata) => `<!--\n---\n${metadata}\n---\n-->`,
    );
    if (host)
        content = content.replace(
            /(!?\[[^\]\n]*\]\()(?:\.\.\/|\.\/)*_resources\//g,
            `$1${host.replace(/\/$/, '')}/_resources/`,
        );
    return content;
}

// 원본 파일을 수정하지 않고 폴더·문서·변환할 본문 정보를 수집합니다.
export async function collectDocuments(root, host) {
    const menus = [];
    const documents = [];
    const excluded = new Set(['_resources', 'pluginAssets', 'index.md']);
    // 리소스 폴더와 비문서 파일을 제외하고 정렬 순서에 따라 계층 메뉴 ID를 생성합니다.
    async function walk(directory, parentId = '') {
        const entries = await Fs.readdir(directory, { withFileTypes: true });
        entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
        let sort = 0;
        for (const entry of entries) {
            if (
                excluded.has(entry.name) ||
                (!entry.isDirectory() && !(entry.isFile() && /\.md$/i.test(entry.name)))
            )
                continue;
            const absolute = Path.join(directory, entry.name);
            const id = [parentId, String(++sort).padStart(3, '0')].filter(Boolean).join('_');
            const path = '/' + Path.relative(root, absolute).split(Path.sep).join('/');
            const title = entry.isDirectory() ? entry.name : entry.name.replace(/\.md$/i, '');
            menus.push({ id, title, parentId, path, isDir: entry.isDirectory() ? 'Y' : 'N', sort });
            if (entry.isDirectory()) await walk(absolute, id);
            else {
                const original = await Fs.readFile(absolute, 'utf8');
                const markdown = resourceContent(original, host);
                documents.push({
                    menuId: id,
                    title,
                    path,
                    markdown,
                    text: documentText(markdown),
                    absolute,
                    original,
                });
            }
        }
    }
    await walk(Path.resolve(root));
    return { menus, documents };
}
