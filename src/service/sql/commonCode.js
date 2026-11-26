import conn from '../../startup/mariadb.js';

export default {
    // 기존 코드 값만 매개변수 쿼리로 수정하고 존재 여부를 반환합니다.
    async updateValue(group, code, value) {
        const [result] = await conn.promise().query(
            `
            UPDATE common_code
            SET CODE_VALUE = ?
            WHERE CODE_GROUP = ? AND CODE = ?
        `,
            [value, group, code],
        );
        // mysql2 기본 FOUND_ROWS 동작: 같은 값으로 수정해도 존재하는 행이면 성공합니다.
        return result.affectedRows > 0;
    },
    // 사용 중인 그룹별 공통코드를 지정된 정렬 순서로 조회합니다.
    async selectByGroup(group) {
        const [rows] = await conn.promise().query(
            `
            SELECT CODE, CODE_NM, CODE_VALUE, SORT_NO
            FROM common_code
            WHERE CODE_GROUP = ? AND USE_YN = 'Y'
            ORDER BY SORT_NO, CODE
        `,
            [group],
        );
        return rows;
    },
};
