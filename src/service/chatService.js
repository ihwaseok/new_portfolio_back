import conn from '../startup/mariadb.js';
import { createIndexCache } from './ragCache.js';
import { normalizeVector } from './ragSearch.js';
import { createChatService } from './ragChat.js';

// 현재 임베딩 모델의 문서 조각을 조회하고 정규화한 검색 인덱스를 캐시합니다.
const getIndex = createIndexCache(async (model) => {
    const [rows] = await conn.promise().query(
        `SELECT M.MENU_ID, M.PARENT_ID, D.TITLE, D.PATH,
        C.CONTENT, C.EMBEDDING, C.EMBEDDING_DIM FROM joplin_document_chunk C
        INNER JOIN joplin_document D ON D.DOCUMENT_ID = C.DOCUMENT_ID
        INNER JOIN admin_menu M ON M.MENU_ID = D.MENU_ID
        WHERE C.EMBEDDING_MODEL = ? AND M.CATEGORY = 'Joplin' AND M.IS_DIR = 'N'`,
        [model],
    );
    return rows
        .map((row) => ({
            menuId: row.MENU_ID,
            parentId: row.PARENT_ID,
            title: row.TITLE,
            path: row.PATH,
            content: row.CONTENT,
            vector: normalizeVector(row.EMBEDDING),
            dimension: row.EMBEDDING_DIM,
        }))
        .filter((row) => /\.md$/i.test(row.path));
});

// 실제 DB 인덱스를 주입하여 운영용 챗봇 서비스를 구성합니다.
export default createChatService({ index: getIndex });
