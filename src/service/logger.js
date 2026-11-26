import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

// 운영인 경우 로그파일 생성, 개발인 경우 콘솔에 로그 출력
let transports = [];
if (process.env.SERVER_ENV == 'prod') {
    transports.push(
        new DailyRotateFile({
            filename: 'logs/server-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
        }),
    );
} else {
    transports.push(new winston.transports.Console());
}

// 커스텀 로그 형식 설정
const customFormat = winston.format.printf(({ level, message, label, timestamp }) => {
    return `${timestamp} [${level}] ${message}`;
});

// 로깅 인스턴스 생성
const logger = winston.createLogger({
    level: 'info',
    levels: winston.config.syslog.levels,
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        customFormat,
    ),
    transports: transports,
});

export default logger;
