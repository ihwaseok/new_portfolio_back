import Fs from 'node:fs/promises';
import Path from 'node:path';

// Preserve body text (including code); remove only export metadata/comments.
export function documentText(markdown) {
    return markdown.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
        .replace(/^---\n[\s\S]*?\n---(?:\n|$)/, '')
        .replace(/<!--[\s\S]*?-->/g, '').trim();
}

export function splitChunks(text, size = 800, overlap = 100) {
    if (!Number.isInteger(size) || !Number.isInteger(overlap) || size < 1 || overlap < 0 || overlap >= size) {
        throw new Error('RAG chunk size/overlap 설정이 잘못되었습니다.');
    }
    const chars = Array.from(text);
    const chunks = [];
    for (let start = 0; start < chars.length; start += size - overlap) {
        const chunk = chars.slice(start, start + size).join('').trim();
        if (chunk) chunks.push(chunk);
        if (start + size >= chars.length) break;
    }
    return chunks;
}

export function resourceContent(markdown, host) {
    let content = markdown.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    content = content.replace(/^---\n([\s\S]*?)\n---(?=\n|$)/,
        (_, metadata) => `<!--\n---\n${metadata}\n---\n-->`);
    if (host) content = content.replace(/(!?\[[^\]\n]*\]\()(?:\.\.\/|\.\/)*_resources\//g,
        `$1${host.replace(/\/$/, '')}/_resources/`);
    return content;
}

export async function collectDocuments(root, host) {
    const menus = [];
    const documents = [];
    const excluded = new Set(['_resources', 'pluginAssets', 'index.md']);
    async function walk(directory, parentId = '') {
        const entries = await Fs.readdir(directory, { withFileTypes: true });
        entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
        let sort = 0;
        for (const entry of entries) {
            if (excluded.has(entry.name) || (!entry.isDirectory() && !(entry.isFile() && /\.md$/i.test(entry.name)))) continue;
            const absolute = Path.join(directory, entry.name);
            const id = [parentId, String(++sort).padStart(3, '0')].filter(Boolean).join('_');
            const path = '/' + Path.relative(root, absolute).split(Path.sep).join('/');
            const title = entry.isDirectory() ? entry.name : entry.name.replace(/\.md$/i, '');
            menus.push({ id, title, parentId, path, isDir: entry.isDirectory() ? 'Y' : 'N', sort });
            if (entry.isDirectory()) await walk(absolute, id);
            else {
                const original = await Fs.readFile(absolute, 'utf8');
                const markdown = resourceContent(original, host);
                documents.push({ menuId: id, title, path, markdown, text: documentText(markdown), absolute, original });
            }
        }
    }
    await walk(Path.resolve(root));
    return { menus, documents };
}
