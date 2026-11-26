import { expressjwt } from 'express-jwt';

// 설정된 서명 키와 알고리즘으로 JWT를 검증하여 인증 정보를 요청에 연결합니다.
const middleware = expressjwt({
    secret: process.env.JWT_SECRET, // JWT 비밀 키
    algorithms: [process.env.JWT_ALGORITHM], // JWT 알고리즘
    getToken: getTokenFromHeader,
});

// 요청 헤더에서 JWT 추출 함수
function getTokenFromHeader(req) {
    if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
        return req.headers.authorization.split(' ')[1];
    }

    return null;
}

export default middleware;
