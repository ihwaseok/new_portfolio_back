import jwt from 'jsonwebtoken';


const serviceObj = {
    // JWT 생성
    generateToken: function() {
        const payload = {
            id: 1,
            username: 'admin'
        };

        const options = {
            expiresIn: '1h',    // 토큰 유효 기간
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, options);

        return token;
    }
};

export default serviceObj;