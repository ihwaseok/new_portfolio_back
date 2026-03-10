import Fs from 'fs';
import Rl from 'readline';
import conn from '../../startup/mariadb.js';


// md 파일 내 메타데이터 주석처리 & 리소스 경로 수정
function updateResourcePath(filePath) {
    const resPath = process.env.JOPLIN_HOST;
    const reader = Fs.createReadStream(filePath);
    const lineEvent = Rl.createInterface(reader);
    let updatedContent = [];
    let metaChk = 0;

    lineEvent.on('line', (line) => {
        // 메타데이터 주석처리
        if (metaChk < 2) {
            if (line.includes('---')) metaChk++;

            if (metaChk <= 2 && !line.includes('<!--')) {
                line = '<!-- ' + line + ' -->';
            } else if (metaChk == 2) {
                metaChk++;
            }
        }

        // 이미지 파일 경로 수정
        if (line.includes('_resources') && !line.includes('http')) {
            line = line.replace(/\.\.\//g, '');
            line = line.replace(/_resources/g, resPath + '/_resources');
        }

        updatedContent.push(Buffer.from(line + '\r'));
    });

    lineEvent.on('close', () => {
        Fs.writeFile(filePath, Buffer.concat(updatedContent).toString(), (err) => {
            if (err) global.Logger.error(`[Joplin Sync] 리소스 경로 수정 에러: ${filePath}`);
        });
    });
}

// 폴더 재귀 탐색하여 dataList에 메뉴 데이터 삽입
function searchRecursive(dirPath, result, option) {
    const childList = Fs.readdirSync(dirPath);
    let sortNo = 0;

    for (const child of childList) {
        if (!option.exceptList.includes(child)) {
            const TIME_ZONE = 3240 * 10000;
            const now = new Date(+new Date() + TIME_ZONE).toISOString().replace('T', ' ').substring(0, 19);
            let data = { MENU_ID: '', MENU_NM: '', PARENT_ID: '', CATEGORY: '', PATH: '', IS_DIR: '', SORT_NO: 0, CREATE_AT: '' };
            sortNo++;

            data.MENU_ID   = option.parentId === '' ? sortNo.toString().padStart(3, '0') : option.parentId + '_' + sortNo.toString().padStart(3, '0');
            data.PARENT_ID = option.parentId;
            data.CATEGORY  = 'Joplin';
            data.PATH      = dirPath + '/' + child;
            data.SORT_NO   = sortNo;
            data.CREATE_AT = now;

            if (child.includes('.md')) {
                data.IS_DIR  = 'N';
                data.MENU_NM = child.replace('.md', '');
                updateResourcePath(data.PATH);
            } else {
                data.IS_DIR  = 'Y';
                data.MENU_NM = child;

                option.parentId = data.MENU_ID;
                searchRecursive(data.PATH, result, option);

                let idList = option.parentId.split('_');
                idList.pop();
                option.parentId = idList.join('_');
            }

            data.PATH = data.PATH.replace(option.rootDir, '');
            result.push(data);
        }
    }
}

const serviceObj = {
    selectMenuList: async function() {
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
                if(err) {
                    return reject(err);
                }

                global.Logger.info(`[DB EXEC] sample.selectMenuList (${rows.length})`);

                return resolve(rows);
            });
        });
    },

    joplinSync: async function() {
        const joplinDir = process.env.JOPLIN_DIR;
        let dataList = [];
        const option = {
            exceptList: ['_resources', 'pluginAssets', 'index.md'],
            parentId: '',
            rootDir: joplinDir
        };

        searchRecursive(joplinDir, dataList, option);

        // 기존 Joplin 데이터 삭제
        await new Promise((resolve, reject) => {
            conn.query('DELETE FROM admin_menu WHERE CATEGORY = "Joplin"', (err) => {
                if (err) return reject(err);
                global.Logger.info('[Joplin Sync] 기존 데이터 삭제 완료');
                resolve();
            });
        });

        if (dataList.length === 0) return 0;

        // 새 데이터 삽입
        const insertQuery = 'INSERT INTO admin_menu (MENU_ID, MENU_NM, PARENT_ID, CATEGORY, PATH, IS_DIR, SORT_NO, CREATED_AT) VALUES ?';
        const values = dataList.map(d => [d.MENU_ID, d.MENU_NM, d.PARENT_ID, d.CATEGORY, d.PATH, d.IS_DIR, d.SORT_NO, d.CREATE_AT]);

        return new Promise((resolve, reject) => {
            conn.query(insertQuery, [values], (err, result) => {
                if (err) return reject(err);
                global.Logger.info(`[Joplin Sync] 데이터 삽입 완료: ${result.affectedRows}건`);
                resolve(result.affectedRows);
            });
        });
    },

    selectMenuByParent: async function(id) {
        const query = `
            SELECT A.MENU_ID, A.MENU_NM, A.PARENT_ID, A.PATH, A.SORT_NO, A.IS_DIR
            FROM admin_menu A
            WHERE A.PARENT_ID = ?
            AND A.IS_DIR = 'N'
            ORDER BY A.SORT_NO
        `;

        return new Promise((resolve, reject) => {
            conn.query(query, [id], (err, rows) => {
                if(err) {
                    return reject(err);
                }

                global.Logger.info(`[DB EXEC] sample.selectMenuByParent (${rows.length})`);

                return resolve(rows);
            });
        });
    }
};

export default serviceObj;