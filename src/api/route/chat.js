import { Router } from 'express';
import verifyApiKey from '../middleware/verifyApiKey.js';
import chat from '../../service/chatService.js';
import { validateChat } from '../../service/ragSearch.js';

export default (app) => {
    const route = Router();
    app.use('/chat', route);
    /**
     * @swagger
     * /chat/messages:
     *   post:
     *     summary: 자동 의도 분류, 일반 대화 또는 문서 기반 챗봇 답변
     *     tags: [Chat]
     *     security:
     *       - apiKeyAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/ChatRequest'
     *     responses:
     *       200:
     *         description: intent가 general이면 일반 답변과 빈 sources를 반환하며 evidence는 없습니다. document이면 최대 3개 sources, 검색 mode, evidence(근거 상태 supported/partial/insufficient)를 반환합니다. 점수는 존재 확률이 아닙니다.
     *       400:
     *         description: 잘못된 질문 또는 대화 내역
     *       401:
     *         description: API 키 누락 또는 불일치
     *       429:
     *         description: 동시 처리 제한 초과
     *       503:
     *         description: 검색 DB 사용 불가
     * /chat/search:
     *   post:
     *     summary: 답변 생성 없이 관련 페이지만 검색
     *     tags: [Chat]
     *     security:
     *       - apiKeyAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/ChatRequest'
     *     responses:
     *       200:
     *         description: 관련 페이지 sources, 검색 방식, evidence. 검색 전용은 생성 모델 검사를 하지 않으므로 supported를 확정하지 않습니다.
     *       400:
     *         description: 잘못된 질문
     *       401:
     *         description: API 키 누락 또는 불일치
     *       429:
     *         description: 동시 처리 제한 초과
     *       503:
     *         description: 검색 DB 사용 불가
     * components:
     *   schemas:
     *     ChatRequest:
     *       type: object
     *       required: [question]
     *       properties:
     *         mode:
     *           type: string
     *           enum: [auto, general, document]
     *           default: auto
     *           description: 자동 분류, 일반 질문, 내 문서 검색. 검색 전용 API는 항상 document로 처리합니다.
     *         question:
     *           type: string
     *           minLength: 1
     *           maxLength: 500
     *           example: Docker host 네트워크 설명은 어디에 있어?
     *         history:
     *           type: array
     *           maxItems: 6
     *           items:
     *             type: object
     *             required: [role, content]
     *             properties:
     *               role:
     *                 type: string
     *                 enum: [user, assistant]
     *               content:
     *                 type: string
     *                 maxLength: 500
     */
    // 프로세스 안에서 검색과 대화 요청의 동시 실행 수를 함께 제한합니다.
    let active = 0;
    for (const path of ['/messages', '/search'])
        route.post(path, verifyApiKey, async (req, res) => {
            let input;
            try {
                input = validateChat(req.body);
            } catch (error) {
                return res.status(400).json({ message: error.message });
            }
            if (active >= 2)
                return res
                    .status(429)
                    .json({ message: '다른 질문을 처리 중입니다. 잠시 후 다시 시도해 주세요.' });
            active++;
            try {
                res.set('Cache-Control', 'no-store');
                return res.json(await chat(input, path === '/search'));
            } catch (error) {
                global.Logger?.error(`[Chat] 요청 실패: ${error.code || error.name}`);
                return res.status(error.status || 500).json({
                    message:
                        error.status === 503 ? error.message : '챗봇 처리 중 오류가 발생했습니다.',
                });
            } finally {
                active--;
            }
        });
};
