import conn from '../../startup/mariadb.js';

export default {
    async updateValue(group, code, value) {
        const [result] = await conn.promise().query(`
            UPDATE common_code
            SET CODE_VALUE = ?
            WHERE CODE_GROUP = ? AND CODE = ?
        `, [value, group, code]);
        // mysql2 기본 FOUND_ROWS 동작: 같은 값으로 수정해도 존재하는 행이면 성공합니다.
        return result.affectedRows > 0;
    },
    async selectByGroup(group) {
        const [rows] = await conn.promise().query(`
            SELECT CODE, CODE_NM, CODE_VALUE, SORT_NO
            FROM common_code
            WHERE CODE_GROUP = ? AND USE_YN = 'Y'
            ORDER BY SORT_NO, CODE
        `, [group]);
        return rows;
    }
};
