// Express 4 does not catch rejected promises from async handlers; forward them
// to the error middleware so the request gets a response instead of hanging.
module.exports = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
