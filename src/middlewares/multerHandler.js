/**
 * Wrap multer middleware so errors reach the global error handler.
 */
function runMulter(middleware) {
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err) return next(err);
      return next();
    });
  };
}

module.exports = { runMulter };
