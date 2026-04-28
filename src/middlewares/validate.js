const ApiError = require('../utils/ApiError');

function validateBody(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      const msg = error.details.map((d) => d.message).join(' ');
      return next(new ApiError(400, msg));
    }
    req.body = value;
    return next();
  };
}

function validateParams(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, { abortEarly: false, stripUnknown: true });
    if (error) {
      const msg = error.details.map((d) => d.message).join(' ');
      return next(new ApiError(400, msg));
    }
    req.params = value;
    return next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      const msg = error.details.map((d) => d.message).join(' ');
      return next(new ApiError(400, msg));
    }
    req.query = value;
    return next();
  };
}

module.exports = { validateBody, validateParams, validateQuery };
