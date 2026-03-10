import { expressjwt } from 'express-jwt';


const middleware = expressjwt({
    secret:     process.env.JWT_SECRET,         // JWT 비밀 키
    algorithms: [process.env.JWT_ALGORITHM],    // JWT 알고리즘
    getToken:   getTokenFromHeader,
});

// 요청 헤더에서 JWT 추출 함수
function getTokenFromHeader(req) {
    if(req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
        return req.headers.authorization.split(' ')[1];
    }

    return null;
}

export default middleware;