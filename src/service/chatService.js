import conn from '../startup/mariadb.js';
import { createIndexCache } from './ragCache.js';
import { normalizeVector } from './ragSearch.js';
import { createChatService } from './ragChat.js';

const getIndex = createIndexCache(async model => {
    const [rows] = await conn.promise().query(`SELECT M.MENU_ID, M.PARENT_ID, D.TITLE, D.PATH,
        C.CONTENT, C.EMBEDDING, C.EMBEDDING_DIM FROM joplin_document_chunk C
        INNER JOIN joplin_document D ON D.DOCUMENT_ID = C.DOCUMENT_ID
        INNER JOIN admin_menu M ON M.MENU_ID = D.MENU_ID
        WHERE C.EMBEDDING_MODEL = ? AND M.CATEGORY = 'Joplin' AND M.IS_DIR = 'N'`, [model]);
    return rows.map(row => ({ menuId: row.MENU_ID, parentId: row.PARENT_ID, title: row.TITLE, path: row.PATH,
        content: row.CONTENT, vector: normalizeVector(row.EMBEDDING), dimension: row.EMBEDDING_DIM }))
        .filter(row => /\.md$/i.test(row.path));
});

export default createChatService({ index: getIndex });
