const Khatma = require('../models/Khatma');

async function authMiddleware(req, res, next) {
  const code = req.headers['x-khatma-code'];
  const khatmaId = req.params.id;

  if (!code) {
    return res.status(401).json({ error: 'رمز الدخول مطلوب' });
  }

  try {
    const khatma = await Khatma.findOne({ _id: khatmaId, access_code: code });

    if (!khatma) {
      return res.status(403).json({ error: 'رمز الدخول غير صحيح' });
    }

    req.khatma = khatma;
    next();
  } catch (err) {
    res.status(500).json({ error: 'خطأ في التحقق' });
  }
}

async function adminMiddleware(req, res, next) {
  const adminPassword = req.headers['x-admin-password'];
  const khatmaId = req.params.id;

  if (!adminPassword) {
    return res.status(401).json({ error: 'كلمة مرور المسؤول مطلوبة' });
  }

  try {
    const khatma = await Khatma.findOne({ _id: khatmaId, admin_password: adminPassword });

    if (!khatma) {
      return res.status(403).json({ error: 'كلمة مرور المسؤول غير صحيحة' });
    }

    req.khatma = khatma;
    next();
  } catch (err) {
    res.status(500).json({ error: 'خطأ في التحقق' });
  }
}

module.exports = { authMiddleware, adminMiddleware };
