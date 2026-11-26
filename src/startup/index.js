import expressLoader from './express.js';
import dbConnection from './mariadb.js';
import swaggerLoader from './swagger.js';
import Logger from '../service/logger.js';

export default async (app) => {
    // 로깅 인스턴스 전역변수 설정
    global.Logger = Logger;

    // Swagger 문서 생성
    await swaggerLoader(app);
    global.Logger.info('Swagger Load Complete.');

    // Express 서버 설정
    await expressLoader(app);
    global.Logger.info('Express Config Load Complete.');

    // MariaDB 연결
    dbConnection.connect();
    global.Logger.info('Database Connect Complete.');
};
