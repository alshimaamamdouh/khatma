const { db } = require('../db/init');

async function authMiddleware(req, res, next) {
  const code = req.headers['x-khatma-code'];
  const khatmaId = req.params.id;

  if (!code) {
    return res.status(401).json({ error: 'رمز الدخول مطلوب' });
  }

  try {
    const result = await db.execute({
      sql: 'SELECT * FROM khatma WHERE id = ? AND access_code = ?',
      args: [khatmaId, code]
    });

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'رمز الدخول غير صحيح' });
    }

    req.khatma = result.rows[0];
    next();
  } catch (err) {
    res.status(500).json({ error: 'خطأ في التحقق' });
  }
}

module.exports = authMiddleware;
