import { Router } from 'express';
import verifyAuth from '../middleware/verifyAuth.js';
import verifyApiKey from '../middleware/verifyApiKey.js';
import AuthService from '../../service/auth.js';
import SampleService from '../../service/sql/sample.js';


const route = Router();

export default (app) => {
    // 모듈별 접두사 설정
    app.use('/sample', route);


    /**
     * @swagger
     * /sample/genJwt:
     *   post:
     *     summary: JWT 토큰 생성 샘플
     *     tags: [Sample]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               password:
     *                 type: integer
     *                 example: 1234
     *             required:
     *               - password
     *     responses:
     *       200:
     *         description: 토큰 결과값을 JSON으로 반환
     */
    route.post('/genJwt', (req, res) => {
        const { password } = req.body;

        let result = '';

        if(password == '1234') {
            result = AuthService.generateToken();
        } else {
            return res.status(400).json({ message: '비밀번호가 틀렸습니다.' });
        }

        return res.status(200).json({ token: result });
    });
  
    /**
     * @swagger
     * /sample/testJwt:
     *   get:
     *     summary: JWT 토큰 검증 테스트
     *     tags: [Sample]
     *     responses:
     *       200:
     *         description: 토큰의 payload 중 name을 JSON으로 반환
     */
    route.get('/testJwt', verifyAuth, (req, res) => {
        return res.status(200).json({ result: req.auth.username });
    });

    /**
     * @swagger
     * /sample/menuList:
     *   get:
     *     summary: DB 조회 테스트
     *     tags: [Sample]
     *     security:
     *       - apiKeyAuth: []
     *     responses:
     *       200:
     *         description: DB 조회결과 출력
     */
    route.get('/menuList', verifyApiKey, async (req, res) => {
        const result = await SampleService.selectMenuList();

        return res.status(200).json({ data: result });
    });

    /**
     * @swagger
     * /sample/menuByParent/{id}:
     *   get:
     *     summary: 특정 부모 메뉴의 하위 메뉴 조회
     *     tags: [Sample]
     *     security:
     *       - apiKeyAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *         description: 부모 메뉴 ID
     *     responses:
     *       200:
     *         description: 하위 메뉴 목록 반환
     */
    route.get('/menuByParent/:id', verifyApiKey, async (req, res) => {
        const { id } = req.params;
        const result = await SampleService.selectMenuByParent(id);

        return res.status(200).json({ data: result });
    });

    /**
     * @swagger
     * /sample/joplinSync:
     *   get:
     *     summary: Joplin 폴더 탐색 후 DB 동기화
     *     description: JOPLIN_DIR 경로의 폴더를 재귀 탐색하여 admin_menu 테이블에 저장합니다. md 파일 내 리소스 경로도 함께 수정됩니다.
     *     tags: [Sample]
     *     security:
     *       - apiKeyAuth: []
     *     responses:
     *       200:
     *         description: 동기화 완료 및 삽입 건수 반환
     */
    route.get('/joplinSync', verifyApiKey, async (req, res) => {
        const count = await SampleService.joplinSync();

        return res.status(200).json({ message: 'Joplin Sync 완료', count });
    });
};