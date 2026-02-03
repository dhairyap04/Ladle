const jwt = require("jsonwebtoken");

// -------- MOVE TO .env after
const SECRET_KEY = "SECRET_KEY";
const REFRESH_KEY = "REFRESH_KEY";

const generateAccessToken = (user) => {
    return jwt.sign({ email: user.email, name: user.name, isFoodbank: user.isFoodbank}, SECRET_KEY, {
        expiresIn: "15m",
    });
};

const generateRefreshToken = (user) => {
    return jwt.sign({ email: user.email, name: user.name, isFoodbank: user.isFoodbank}, REFRESH_KEY, {
        expiresIn: "200d"
    });
};

const verify = (req, res, next) => {
    try {
        const { accessToken, refreshToken } = req.cookies;
        // console.log(req.cookies);
        let handled = false;

        if (accessToken) {
            // Check Access Token
            jwt.verify(accessToken, SECRET_KEY, (err, user) => {
                if (!err) {
                    req.user = user;
                    handled = true;
                    return next();
                }
            });
        }

        // Try to use refresh token
        if (refreshToken && !handled) {
            jwt.verify(refreshToken, REFRESH_KEY, (err, user) => {
                if (!err) {
                    const newAccessToken = generateAccessToken(user);
                    req.user = user;
                    res.cookie("accessToken", newAccessToken, {
                        maxAge: 900000, // 15 minutes
                        httpOnly: true,
                    });
                    return next();
                } else {
                    return res.status(401).json({ msg: "Access Expired. Please login!" });
                }
            });
            
        } else if (!handled) {
            return res.status(401).json({ msg: "No authorization detected. Login!" });
        }

    } catch (error) {
        res.sendStatus(500);
    }
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verify,
}