import mysql from 'mysql2';

// 환경변수에 지정된 DB로 일반 API 조회·수정용 연결을 생성합니다.
const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    database: process.env.DB_SCHEME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

export default connection;
