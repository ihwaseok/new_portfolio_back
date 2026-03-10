// 요청 헤더의 x-auth-key 값을 환경변수 AUTH_KEY와 비교하는 미들웨어
function verifyApiKey(req, res, next) {
    const key = req.headers['x-auth-key'];

    if (!key || key !== process.env.AUTH_KEY) {
        return res.status(401).json({ message: '유효하지 않은 인증 키입니다.' });
    }

    next();
}

export default verifyApiKey;
