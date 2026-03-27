const express = require('express');
const router = express.Router();
const Khatma = require('../models/Khatma');
const Participant = require('../models/Participant');
const Deceased = require('../models/Deceased');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { getCycleNumber, getCurrentJuz, getCycleDedication, isPaused, getRotationLabel, getCycleDays } = require('../utils/rotation');

// Access a Khatma by code (participant login)
router.post('/access', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'الرجاء إدخال رمز الختمة' });
  }

  try {
    const khatma = await Khatma.findOne({ access_code: code }).select('-admin_password');
    if (!khatma) {
      return res.status(404).json({ error: 'رمز الختمة غير صحيح' });
    }

    const participants = await Participant.find({ khatma_id: khatma._id }).sort('slot_number');

    res.json({ khatma, participants });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Admin login
router.post('/admin-login', async (req, res) => {
  const { code, adminPassword } = req.body;
  if (!code || !adminPassword) {
    return res.status(400).json({ error: 'رمز الختمة وكلمة مرور المسؤول مطلوبان' });
  }

  try {
    const khatma = await Khatma.findOne({ access_code: code, admin_password: adminPassword });
    if (!khatma) {
      return res.status(404).json({ error: 'رمز الختمة أو كلمة مرور المسؤول غير صحيحة' });
    }

    const participants = await Participant.find({ khatma_id: khatma._id }).sort('slot_number');
    const deceased = await Deceased.find({ khatma_id: khatma._id }).sort('death_date');

    res.json({
      khatma: {
        _id: khatma._id,
        name: khatma.name,
        access_code: khatma.access_code,
        start_date: khatma.start_date,
        rotation_type: khatma.rotation_type,
        custom_days: khatma.custom_days,
        paused_from: khatma.paused_from,
        paused_to: khatma.paused_to,
        created_at: khatma.created_at
      },
      participants,
      deceased
    });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Create a new Khatma
router.post('/', async (req, res) => {
  const { name, accessCode, adminPassword, startDate, rotationType, customDays, participants, deceased } = req.body;

  if (!name || !accessCode || !adminPassword || !startDate) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
  }

  try {
    const existing = await Khatma.findOne({ access_code: accessCode });
    if (existing) {
      return res.status(409).json({ error: 'رمز الدخول مستخدم بالفعل، اختر رمزاً آخر' });
    }

    const khatma = await Khatma.create({
      name,
      access_code: accessCode,
      admin_password: adminPassword,
      start_date: startDate,
      rotation_type: rotationType || 'weekly',
      custom_days: rotationType === 'custom' ? (customDays || 7) : null
    });

    if (participants && participants.length > 0) {
      const docs = participants.map(p => ({
        khatma_id: khatma._id,
        name: p.name,
        slot_number: p.slotNumber
      }));
      await Participant.insertMany(docs);
    }

    if (deceased && deceased.length > 0) {
      const docs = deceased.map(d => ({
        khatma_id: khatma._id,
        name: d.name,
        death_date: d.deathDate
      }));
      await Deceased.insertMany(docs);
    }

    res.status(201).json({ id: khatma._id, message: 'تم إنشاء الختمة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الختمة' });
  }
});

// Get dashboard data (participant view)
router.get('/:id/dashboard', authMiddleware, async (req, res) => {
  try {
    const khatma = req.khatma;
    const paused = isPaused(khatma.paused_from, khatma.paused_to);
    const cycleNumber = getCycleNumber(
      khatma.start_date, new Date(),
      khatma.paused_from, khatma.paused_to,
      khatma.rotation_type, khatma.custom_days
    );

    const participants = await Participant.find({ khatma_id: khatma._id }).sort('slot_number');
    const deceasedList = await Deceased.find({ khatma_id: khatma._id }).sort('death_date');

    const participantsWithJuz = participants.map(p => ({
      _id: p._id,
      khatma_id: p.khatma_id,
      name: p.name,
      slot_number: p.slot_number,
      currentJuz: getCurrentJuz(p.slot_number, cycleNumber)
    }));

    const cycleDays = getCycleDays(khatma.rotation_type, khatma.custom_days);
    const dedication = getCycleDedication(deceasedList, cycleNumber, new Date(), cycleDays);
    const rotationLabel = getRotationLabel(khatma.rotation_type, khatma.custom_days);

    res.json({
      khatma: {
        _id: khatma._id,
        name: khatma.name,
        access_code: khatma.access_code,
        start_date: khatma.start_date,
        rotation_type: khatma.rotation_type,
        custom_days: khatma.custom_days,
        paused_from: khatma.paused_from,
        paused_to: khatma.paused_to
      },
      cycleNumber: cycleNumber + 1,
      rotationLabel,
      paused,
      participants: participantsWithJuz,
      dedication,
      deceased: deceasedList
    });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Update Khatma (admin only)
router.put('/:id', adminMiddleware, async (req, res) => {
  const { name, startDate, rotationType, customDays, pausedFrom, pausedTo } = req.body;
  const update = {};

  if (name) update.name = name;
  if (startDate) update.start_date = startDate;
  if (rotationType) {
    update.rotation_type = rotationType;
    update.custom_days = rotationType === 'custom' ? (customDays || 7) : null;
  }
  if (pausedFrom !== undefined) update.paused_from = pausedFrom || null;
  if (pausedTo !== undefined) update.paused_to = pausedTo || null;

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: 'لا توجد بيانات للتحديث' });
  }

  try {
    await Khatma.findByIdAndUpdate(req.khatma._id, update);
    res.json({ message: 'تم التحديث بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Delete Khatma (admin only)
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    await Participant.deleteMany({ khatma_id: req.khatma._id });
    await Deceased.deleteMany({ khatma_id: req.khatma._id });
    await Khatma.findByIdAndDelete(req.khatma._id);
    res.json({ message: 'تم حذف الختمة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

module.exports = router;
