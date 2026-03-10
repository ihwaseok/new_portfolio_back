import express from 'express';
import dotenv from 'dotenv';

const app = express();

// 환경변수 가져오기
const env = dotenv.config({ path: './.env.dev' });
if(env.error) {
    throw new Error("Fail to Load Enviroment. Couldn't find .env file");
}

// 환경변수 로딩 후 서버 초기화
const { default: startup } = await import('./src/startup/index.js');
await startup(app);

app.listen(process.env.SERVER_PORT, () => {
    global.Logger.info(`Server is running on http://${process.env.SERVER_HOST}:${process.env.SERVER_PORT}`);
    global.Logger.info(`Swagger is running on http://${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/docs`);
});