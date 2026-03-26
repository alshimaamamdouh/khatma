const db = require('../db/init');

function authMiddleware(req, res, next) {
  const code = req.headers['x-khatma-code'];
  const khatmaId = req.params.id;

  if (!code) {
    return res.status(401).json({ error: 'رمز الدخول مطلوب' });
  }

  const khatma = db.prepare('SELECT * FROM khatma WHERE id = ? AND access_code = ?').get(khatmaId, code);

  if (!khatma) {
    return res.status(403).json({ error: 'رمز الدخول غير صحيح' });
  }

  req.khatma = khatma;
  next();
}

module.exports = authMiddleware;
