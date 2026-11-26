import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import { fileURLToPath } from 'url';

const filePath = fileURLToPath(import.meta.url);
const dirPath = path.dirname(filePath);

// Swagger 문서 공통설정
const options = {
    definition: {
        openapi: '3.1.1',
        info: {
            title: process.env.SWAGGER_TITLE,
            version: process.env.SWAGGER_VERSION,
        },
        // Swagger를 연 주소의 프로토콜/호스트를 사용합니다 (HTTPS 프록시 지원).
        servers: [{ url: process.env.API_PREFIX || '/' }],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
                apiKeyAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'x-auth-key',
                },
            },
        },
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
    },
    apis: [path.resolve(dirPath, '../api/route/*.js')],
};

const swaggerSpec = swaggerJsdoc(options);

export default async (app) => {
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};
