import { Router } from 'express';
import logging from './middleware/logging.js';
import sample from './route/sample.js';


// API 모듈 통합관리
export default () => {
	const app = Router();

	// API 로깅 미들웨어 등록
	app.use(logging);

	// API 모듈 등록
	sample(app);

	return app
}