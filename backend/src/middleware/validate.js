const { validationResult } = require("express-validator");
const ApiError = require("../utils/ApiError");

function validate(rules) {
  return async (req, res, next) => {
    if (rules) await Promise.all(rules.map((rule) => rule.run(req)));
    const result = validationResult(req);
    if (result.isEmpty()) return next();
    const details = result.array({ onlyFirstError: true }).map((e) => ({
      field: e.path,
      message: e.msg,
    }));
    return next(
      new ApiError(422, "VALIDATION_ERROR", details[0]?.message || "Invalid input.", details)
    );
  };
}

module.exports = { validate };