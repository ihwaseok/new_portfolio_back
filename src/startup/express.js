import express from 'express';
import cors from 'cors';
import routes from '../api/index.js';

export default async (app) => {
    // 서버 Health Check
    app.get('/status', (req, res) => {
        res.status(200).end();
    });

    // Nginx 등의 프록시 서버를 통해 들어온 요청의 IP 정보 신뢰 (클라이언트의 실제 IP 확인용)
    app.enable('trust proxy');

    // CORS 설정 - 모든 출처 허용
    app.use(cors());

    // application/json 요청 본문을 자동으로 파싱하여 req.body에 저장
    app.use(express.json());

    // 304 캐시응답 비활성화
    app.disable('etag');

    // API 등록
    app.use(process.env.API_PREFIX, routes());

    // API에 등록되지 않은 경로를 404 에러로 처리하여 전달
    app.use((req, res, next) => {
        const err = new Error('Not Found');
        err['status'] = 404;

        //global.Logger.error(`${req.method} ${req.originalUrl} - 404`);

        next(err);
    });

    // 전체 에러 핸들러
    app.use((err, req, res, next) => {
        switch (err.status) {
            case 401:
                global.Logger.error(err);
                return res.status(err.status).json({ message: err.message });

            case 404:
                break;

            default:
                global.Logger.error(err.stack);
                break;
        }

        return res.status(err.status || 500).json({ errors: { message: err.message } });
    });
};
