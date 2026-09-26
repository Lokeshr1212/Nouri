function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function fail(res, message, code = undefined, status = 400, details = undefined) {
  return res.status(status).json({
    success: false,
    error: { message, code: code || "ERROR", details },
  });
}

module.exports = { ok, fail };