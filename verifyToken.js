const Jwt = require('jsonwebtoken');

function verifyToken(role) {
  return function (req, res, next) {
    let token = req.headers.authorization.split(' ')[1];
    Jwt.verify(token, process.env.JWT_KEY, (err, valid) => {
      if (err) {
        res.status(401).send({ message: "Token expired. Please login again" });
      }
      else {
        req[role] = valid[role];
        if (role in valid && valid[role].role === role) {
          next();
        }
        else res.status(401).send({ message: "Unauthorized!" })
      }
    })
  }
}

module.exports = verifyToken;