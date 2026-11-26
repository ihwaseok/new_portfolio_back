import { Router } from 'express';
import verifyApiKey from '../middleware/verifyApiKey.js';
import CommonCodeService from '../../service/sql/commonCode.js';
import validateCommonCodeUpdate from '../middleware/validateCommonCodeUpdate.js';

export default (app) => {
    const route = Router();
    app.use('/common-codes', route);

    /**
     * @swagger
     * /common-codes/{group}/{code}:
     *   patch:
     *     summary: 그룹 안의 공통코드 값 수정 (비활성 코드도 수정 가능)
     *     tags: [CommonCode]
     *     security:
     *       - apiKeyAuth: []
     *     parameters:
     *       - in: path
     *         name: group
     *         required: true
     *         schema:
     *           type: string
     *           minLength: 1
     *           maxLength: 100
     *         example: PORTFOLIO
     *       - in: path
     *         name: code
     *         required: true
     *         schema:
     *           type: string
     *           minLength: 1
     *           maxLength: 100
     *         example: DEFAULT_OPEN_MENU_ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             additionalProperties: false
     *             required: [CODE_VALUE]
     *             properties:
     *               CODE_VALUE:
     *                 type: string
     *                 maxLength: 1000
     *                 description: 빈 문자열은 자동 선택 해제에 사용
     *           example:
     *             CODE_VALUE: '001_002'
     *     responses:
     *       200:
     *         description: 수정 성공 (기존 값과 같아도 성공)
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               required: [data]
     *               properties:
     *                 data:
     *                   type: object
     *                   required: [CODE_GROUP, CODE, CODE_VALUE]
     *                   properties:
     *                     CODE_GROUP:
     *                       type: string
     *                     CODE:
     *                       type: string
     *                     CODE_VALUE:
     *                       type: string
     *       400:
     *         description: 잘못된 요청 본문 또는 그룹/코드 길이
     *       401:
     *         description: 인증 키 누락 또는 불일치
     *       404:
     *         description: 해당 그룹에 코드가 없음 (자동 생성하지 않음)
     *       500:
     *         description: DB 수정 실패
     */
    route.patch('/:group/:code', verifyApiKey, validateCommonCodeUpdate, async (req, res) => {
        const { group, code } = req.params;
        const { CODE_VALUE } = req.body;
        const updated = await CommonCodeService.updateValue(group, code, CODE_VALUE);
        if (!updated) return res.status(404).json({ message: '공통코드를 찾을 수 없습니다.' });
        res.set('Cache-Control', 'no-store');
        return res.status(200).json({ data: { CODE_GROUP: group, CODE: code, CODE_VALUE } });
    });

    /**
     * @swagger
     * /common-codes/{group}:
     *   get:
     *     summary: 그룹별 사용 중인 공통코드 조회 (없는 그룹은 빈 배열 반환)
     *     tags: [CommonCode]
     *     security:
     *       - apiKeyAuth: []
     *     parameters:
     *       - in: path
     *         name: group
     *         required: true
     *         schema:
     *           type: string
     *         example: PORTFOLIO
     *     responses:
     *       200:
     *         description: 공통코드 목록
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               required: [data]
     *               properties:
     *                 data:
     *                   type: array
     *                   items:
     *                     type: object
     *                     required: [CODE, CODE_NM, CODE_VALUE, SORT_NO]
     *                     properties:
     *                       CODE:
     *                         type: string
     *                       CODE_NM:
     *                         type: string
     *                       CODE_VALUE:
     *                         type: string
     *                       SORT_NO:
     *                         type: integer
     *       401:
     *         description: 인증 키 누락 또는 불일치
     *       500:
     *         description: DB 조회 실패
     */
    route.get('/:group', verifyApiKey, async (req, res) => {
        const data = await CommonCodeService.selectByGroup(req.params.group);
        res.set('Cache-Control', 'no-store');
        return res.status(200).json({ data });
    });
};
