import { Router } from 'express';
import logging from './middleware/logging.js';
import sample from './route/sample.js';
import commonCode from './route/commonCode.js';
import chat from './route/chat.js';

// API 모듈 통합관리
export default () => {
    const app = Router();

    // API 로깅 미들웨어 등록
    app.use(logging);

    // API 모듈 등록
    sample(app);
    commonCode(app);
    chat(app);

    return app;
};
