// 경로의 그룹·코드와 수정 본문의 필드·자료형·길이를 검사합니다.
export default function validateCommonCodeUpdate(req, res, next) {
    const { group, code } = req.params;
    const body = req.body;
    const length = (value) => Array.from(value).length;
    if (!group.trim() || !code.trim() || length(group) > 100 || length(code) > 100) {
        return res.status(400).json({ message: '그룹과 코드는 1~100자여야 합니다.' });
    }
    if (
        !body ||
        typeof body !== 'object' ||
        Array.isArray(body) ||
        Object.keys(body).length !== 1 ||
        !Object.hasOwn(body, 'CODE_VALUE') ||
        typeof body.CODE_VALUE !== 'string' ||
        length(body.CODE_VALUE) > 1000
    ) {
        return res.status(400).json({
            message: 'CODE_VALUE 문자열(최대 1000자)만 전달하세요. 빈 문자열은 허용됩니다.',
        });
    }
    next();
}
