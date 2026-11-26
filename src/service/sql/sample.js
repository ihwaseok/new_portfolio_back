import conn from '../../startup/mariadb.js';
import { syncJoplin } from '../joplinSync.js';

const serviceObj = {
    // Joplin 폴더 목록에 하위 폴더 여부와 직접 포함된 문서 수를 함께 조회합니다.
    selectMenuList: async function () {
        const query = `
            SELECT A.MENU_ID, A.MENU_NM, A.PARENT_ID, A.PATH, A.SORT_NO
                    , IF(COUNT(B.MENU_ID) = 0, 'N', 'Y') AS IS_DIR
                    , GROUP_CONCAT(B.MENU_ID ORDER BY B.SORT_NO) AS CHILD_MENU_ID
                    , COUNT(DISTINCT C.MENU_ID) AS SUB_CNT
            FROM admin_menu A
            LEFT OUTER JOIN admin_menu B
                ON A.MENU_ID = B.PARENT_ID
                AND B.IS_DIR = 'Y'
            LEFT OUTER JOIN admin_menu C
                ON A.MENU_ID = C.PARENT_ID
                AND C.IS_DIR = 'N'
            WHERE A.IS_DIR = 'Y'
            AND A.CATEGORY = 'Joplin'
            GROUP BY A.MENU_ID, A.MENU_NM, A.PARENT_ID, A.PATH, A.SORT_NO, A.IS_DIR
            ORDER BY A.MENU_ID
        `;

        return new Promise((resolve, reject) => {
            conn.query(query, (err, rows) => {
                if (err) {
                    return reject(err);
                }

                global.Logger.info(`[DB EXEC] sample.selectMenuList (${rows.length})`);

                return resolve(rows);
            });
        });
    },

    // 문서와 임베딩 동기화는 별도 서비스에 위임합니다.
    joplinSync: syncJoplin,

    // 지정한 부모 메뉴에 속한 문서를 정렬 순서로 조회합니다.
    selectMenuByParent: async function (id) {
        const query = `
            SELECT A.MENU_ID, A.MENU_NM, A.PARENT_ID, A.PATH, A.SORT_NO, A.IS_DIR
            FROM admin_menu A
            WHERE A.PARENT_ID = ?
            AND A.IS_DIR = 'N'
            ORDER BY A.SORT_NO
        `;

        return new Promise((resolve, reject) => {
            conn.query(query, [id], (err, rows) => {
                if (err) {
                    return reject(err);
                }

                global.Logger.info(`[DB EXEC] sample.selectMenuByParent (${rows.length})`);

                return resolve(rows);
            });
        });
    },
};

export default serviceObj;
