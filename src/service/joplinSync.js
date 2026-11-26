import Fs from 'node:fs/promises';
import Mysql from 'mysql2/promise';
import { collectDocuments, splitChunks } from './joplinDocuments.js';
import { embeddingConfig, embedText } from './embedding.js';
import { createSyncProgress } from './syncProgress.js';
import { invalidateRagIndex } from './ragCache.js';

let running = false;

export async function syncJoplin() {
    if (running) throw Object.assign(new Error('Joplin Sync가 이미 실행 중입니다.'), { status: 409 });
    running = true;
    let db;
    let locked = false;
    const progress = createSyncProgress();
    try {
        progress.stage('시작: 설정 및 DB 확인');
        if (!process.env.JOPLIN_DIR) throw new Error('JOPLIN_DIR을 설정하세요.');
        const config = embeddingConfig();
        const size = Number(process.env.RAG_CHUNK_SIZE || 800);
        const overlap = Number(process.env.RAG_CHUNK_OVERLAP || 100);
        splitChunks('', size, overlap);
        // Dedicated connection: unrelated API queries must not join this transaction.
        db = await Mysql.createConnection({ host: process.env.DB_HOST, database: process.env.DB_SCHEME,
            user: process.env.DB_USER, password: process.env.DB_PASSWORD });
        const [locks] = await db.query("SELECT GET_LOCK(CONCAT(DATABASE(), ':joplinSync'), 0) AS acquired");
        locked = Number(locks[0].acquired) === 1;
        if (!locked) throw Object.assign(new Error('Joplin Sync가 이미 실행 중입니다.'), { status: 409 });
        // Fail early if the migration has not been applied.
        await db.query('SELECT DOCUMENT_ID FROM joplin_document LIMIT 0');
        await db.query('SELECT DOCUMENT_ID FROM joplin_document_chunk LIMIT 0');
        progress.stage(`파일 탐색 시작 | 모델 ${config.model}`);
        const { menus, documents } = await collectDocuments(process.env.JOPLIN_DIR, process.env.JOPLIN_HOST);
        if (!menus.length) throw new Error('Joplin 폴더가 비어 있어 기존 데이터 삭제를 중단했습니다.');
        let totalChunks = 0;
        for (const document of documents) {
            document.pendingChunks = splitChunks(document.text, size, overlap);
            totalChunks += document.pendingChunks.length;
        }
        progress.stage(`파일 탐색 완료 | 메뉴 ${menus.length}개 | 문서 ${documents.length}개 | 총 조각 ${totalChunks}개`);
        let dimension;
        let chunkCount = 0;
        for (const [documentIndex, document] of documents.entries()) {
            document.chunks = [];
            for (let index = 0; index < document.pendingChunks.length;) {
                const text = document.pendingChunks[index];
                progress.stage(`임베딩 요청 | 문서 ${documentIndex + 1}/${documents.length} | 조각 ${index + 1}/${document.pendingChunks.length} | ${document.path} | 완료 ${chunkCount}/${totalChunks}`);
                let vector;
                try {
                    vector = await embedText(text, config);
                } catch (error) {
                    // E5 has a 512-token limit. Split instead of silently truncating.
                    const chars = Array.from(text);
                    if (error.status !== 413 || chars.length < 2) throw error;
                    const middle = Math.ceil(chars.length / 2);
                    document.pendingChunks.splice(index, 1, chars.slice(0, middle).join(''), chars.slice(middle).join(''));
                    totalChunks++;
                    progress.stage(`토큰 제한으로 조각 재분할 | ${document.path} | 총 조각 ${totalChunks}개`);
                    continue;
                }
                dimension ??= vector.length;
                if (vector.length !== dimension) throw new Error('임베딩 벡터 차원이 일치하지 않습니다.');
                document.chunks.push({ text, vector });
                chunkCount++;
                index++;
                progress.embedding(chunkCount, totalChunks, documentIndex + 1, documents.length, document.path, index, document.pendingChunks.length);
            }
            progress.stage(`문서 임베딩 완료 ${documentIndex + 1}/${documents.length} | ${document.path} | ${document.chunks.length}개 조각`);
        }
        progress.stage(`임베딩 완료 | ${chunkCount}개 벡터 | 정적 파일 갱신 시작`);
        // Preserve the existing static-file behavior, but await every write.
        for (const document of documents) {
            if (document.markdown !== document.original) await Fs.writeFile(document.absolute, document.markdown, 'utf8');
        }
        progress.stage('DB 저장 시작 (커밋 전까지 기존 데이터 유지)');
        await db.beginTransaction();
        try {
            await db.query("DELETE D FROM joplin_document D INNER JOIN admin_menu M ON M.MENU_ID = D.MENU_ID WHERE M.CATEGORY = 'Joplin'");
            await db.query("DELETE FROM admin_menu WHERE CATEGORY = 'Joplin'");
            for (const menu of menus) {
                await db.execute(`INSERT INTO admin_menu
                    (MENU_ID, MENU_NM, PARENT_ID, CATEGORY, PATH, IS_DIR, SORT_NO, CREATED_AT)
                    VALUES (?, ?, ?, 'Joplin', ?, ?, ?, DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'))`,
                [menu.id, menu.title, menu.parentId, menu.path, menu.isDir, menu.sort]);
            }
            for (const [documentIndex, document] of documents.entries()) {
                const [result] = await db.execute(`INSERT INTO joplin_document
                    (MENU_ID, TITLE, PATH, MARKDOWN, CONTENT) VALUES (?, ?, ?, ?, ?)`,
                [document.menuId, document.title, document.path, document.markdown, document.text]);
                for (const [index, chunk] of document.chunks.entries()) {
                    await db.execute(`INSERT INTO joplin_document_chunk
                        (DOCUMENT_ID, CHUNK_NO, CONTENT, EMBEDDING_MODEL, EMBEDDING_DIM, EMBEDDING)
                        VALUES (?, ?, ?, ?, ?, ?)`,
                    [result.insertId, index, chunk.text, config.model, chunk.vector.length, JSON.stringify(chunk.vector)]);
                }
                progress.stage(`DB 문서 저장 ${documentIndex + 1}/${documents.length} | ${document.path}`);
            }
            progress.stage('DB 커밋 시작');
            await db.commit();
            invalidateRagIndex();
        } catch (error) {
            await db.rollback();
            throw error;
        }
        progress.stage(`전체 완료 (DB 커밋 성공) | 메뉴 ${menus.length}, 문서 ${documents.length}, 벡터 ${chunkCount}건`);
        return menus.length;
    } catch (error) {
        progress.fail(error);
        // Upstream HTTP status is not the sync endpoint's status contract.
        if (error.status && error.status !== 409) delete error.status;
        throw error;
    } finally {
        try {
            if (db && locked) await db.query("SELECT RELEASE_LOCK(CONCAT(DATABASE(), ':joplinSync'))");
        } finally {
            try { if (db) await db.end(); } finally { running = false; }
        }
    }
}
