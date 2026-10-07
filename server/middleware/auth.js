const mongoose = require('mongoose');
const Khatma = require('../models/Khatma');
const Participant = require('../models/Participant');

// Client URL-encodes header values so non-Latin (Arabic) text survives
function decodeHeader(value) {
  if (!value) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function authMiddleware(req, res, next) {
  const code = decodeHeader(req.headers['x-khatma-code']);
  const khatmaId = req.params.id;

  if (!code) {
    return res.status(401).json({ error: 'رمز الدخول مطلوب' });
  }

  if (!mongoose.Types.ObjectId.isValid(khatmaId)) {
    return res.status(400).json({ error: 'معرف الختمة غير صحيح' });
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
  const adminPassword = decodeHeader(req.headers['x-admin-password']);
  const khatmaId = req.params.id;

  if (!adminPassword) {
    return res.status(401).json({ error: 'كلمة مرور المسؤول مطلوبة' });
  }

  if (!mongoose.Types.ObjectId.isValid(khatmaId)) {
    return res.status(400).json({ error: 'معرف الختمة غير صحيح' });
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

// True when the request may change this participant's reading status:
// the organizer (admin password) or the phone that claimed this participant (token).
async function canActFor(req, participantId) {
  const adminPassword = decodeHeader(req.headers['x-admin-password']);
  if (adminPassword && adminPassword === req.khatma.admin_password) return true;

  const token = req.headers['x-participant-token'];
  if (!token) return false;

  const participant = await Participant.findOne({ _id: participantId, khatma_id: req.khatma._id }).select('+token');
  return !!participant && !!participant.token && participant.token === token;
}

module.exports = { authMiddleware, adminMiddleware, canActFor };
