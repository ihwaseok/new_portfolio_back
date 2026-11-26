import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';

// 명령줄에서 지정한 환경파일을 읽고 없으면 개발 설정을 사용합니다.
const envFile = process.argv[2] || '.env.dev';
const env = dotenv.config({ path: envFile, quiet: true });
if (env.error) throw new Error('환경설정 파일을 읽을 수 없습니다.');

let connection;
try {
    connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        database: process.env.DB_SCHEME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectTimeout: 10000,
    });
    // 공통코드 테이블과 기본값을 적용하는 SQL을 읽어 순서대로 실행합니다.
    const sql = await readFile(new URL('../sql/001_common_code.sql', import.meta.url), 'utf8');
    for (const statement of sql.split(';').filter((part) => part.trim())) {
        await connection.query(statement);
    }
    console.log('common_code 테이블 및 기본 설정 적용 완료');
} catch (error) {
    console.error(`공통코드 마이그레이션 실패: ${error.code || 'UNKNOWN'}`);
    process.exitCode = 1;
} finally {
    // 성공·실패와 관계없이 마이그레이션용 DB 연결을 종료합니다.
    if (connection) await connection.end();
}
