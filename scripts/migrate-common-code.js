import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';

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
        connectTimeout: 10000
    });
    const sql = await readFile(new URL('../sql/001_common_code.sql', import.meta.url), 'utf8');
    for (const statement of sql.split(';').filter(part => part.trim())) {
        await connection.query(statement);
    }
    console.log('common_code 테이블 및 기본 설정 적용 완료');
} catch (error) {
    console.error(`공통코드 마이그레이션 실패: ${error.code || 'UNKNOWN'}`);
    process.exitCode = 1;
} finally {
    if (connection) await connection.end();
}
