const express = require('express');
const router = express.Router();
const Khatma = require('../models/Khatma');
const Participant = require('../models/Participant');
const Deceased = require('../models/Deceased');
const Completion = require('../models/Completion');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { getCycleNumber, getCurrentJuz, getCycleDedication, isPaused, getRotationLabel, getCycleDays, getNextChangeDate } = require('../utils/rotation');
const { normalizePhone } = require('../utils/phone');
const { newToken } = require('../utils/token');

const ROTATION_TYPES = ['daily', 'weekly', 'biweekly', 'monthly', 'custom'];
const isValidCustomDays = v => v === undefined || v === null || v === '' || (Number.isInteger(Number(v)) && Number(v) >= 1);
const isValidSlot = n => Number.isInteger(n) && n >= 1 && n <= 30;

// Access a Khatma by code (participant login)
router.post('/access', async (req, res) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string') {
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
  if (!code || !adminPassword || typeof code !== 'string' || typeof adminPassword !== 'string') {
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
        use_hijri: khatma.use_hijri,
        is_quick: khatma.is_quick,
        khatma_number: khatma.khatma_number,
        organizer_phone: khatma.organizer_phone || null,
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
  const { name, accessCode, adminPassword, startDate, rotationType, customDays, useHijri, khatmaNumber, isQuick, organizerPhone, participants, deceased } = req.body;

  if (!name || !accessCode || !adminPassword || !startDate ||
      typeof name !== 'string' || typeof accessCode !== 'string' || typeof adminPassword !== 'string' ||
      typeof startDate !== 'string') {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
  }
  if (rotationType !== undefined && rotationType !== null && !ROTATION_TYPES.includes(rotationType)) {
    return res.status(400).json({ error: 'نوع التدوير غير صحيح' });
  }
  if (rotationType === 'custom' && !isValidCustomDays(customDays)) {
    return res.status(400).json({ error: 'عدد الأيام غير صحيح' });
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
      custom_days: rotationType === 'custom' ? (customDays || 7) : null,
      use_hijri: useHijri || false,
      is_quick: isQuick || false,
      khatma_number: khatmaNumber || 1,
      organizer_phone: normalizePhone(organizerPhone)
    });

    try {
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
    } catch (childErr) {
      // Don't leave a half-created khatma behind (it would also block the access code)
      await Participant.deleteMany({ khatma_id: khatma._id });
      await Deceased.deleteMany({ khatma_id: khatma._id });
      await Khatma.findByIdAndDelete(khatma._id);
      return res.status(400).json({ error: 'بيانات الأسماء غير صحيحة' });
    }

    res.status(201).json({ id: khatma._id, message: 'تم إنشاء الختمة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الختمة' });
  }
});

// Self-join a quick khatma (no admin needed)
router.post('/:id/join', authMiddleware, async (req, res) => {
  const { name, slotNumber } = req.body;

  if (!name || typeof name !== 'string' || !slotNumber) {
    return res.status(400).json({ error: 'الاسم ورقم الجزء مطلوبان' });
  }

  if (!isValidSlot(slotNumber)) {
    return res.status(400).json({ error: 'رقم الجزء يجب أن يكون بين 1 و 30' });
  }

  try {
    const khatma = req.khatma;
    if (!khatma.is_quick) {
      return res.status(403).json({ error: 'هذه الختمة ليست ختمة سريعة' });
    }

    const token = newToken();
    const participant = await Participant.create({
      khatma_id: khatma._id,
      name,
      slot_number: slotNumber,
      token
    });

    res.status(201).json({
      message: 'تم التسجيل بنجاح',
      participant: { _id: participant._id, name: participant.name, slot_number: participant.slot_number },
      token
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'هذا الجزء مشغول بالفعل' });
    }
    res.status(500).json({ error: 'حدث خطأ' });
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
    const nextChangeDate = (khatma.is_quick || paused)
      ? null
      : getNextChangeDate(khatma.start_date, khatma.rotation_type, khatma.custom_days);

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
        use_hijri: khatma.use_hijri,
        is_quick: khatma.is_quick,
        khatma_number: khatma.khatma_number,
        organizer_phone: khatma.organizer_phone || null
      },
      cycleNumber: cycleNumber + 1,
      currentKhatmaNumber: (khatma.khatma_number || 1) + cycleNumber,
      rotationLabel,
      nextChangeDate,
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
  const { name, startDate, rotationType, customDays, pausedFrom, pausedTo, useHijri, organizerPhone } = req.body;
  const update = {};

  if ([name, startDate, rotationType].some(v => v != null && typeof v !== 'string') ||
      (rotationType && !ROTATION_TYPES.includes(rotationType))) {
    return res.status(400).json({ error: 'بيانات غير صحيحة' });
  }
  if (rotationType === 'custom' && !isValidCustomDays(customDays)) {
    return res.status(400).json({ error: 'عدد الأيام غير صحيح' });
  }

  if (name) update.name = name;
  if (startDate) update.start_date = startDate;
  if (req.body.khatmaNumber !== undefined) update.khatma_number = req.body.khatmaNumber;
  if (rotationType) {
    update.rotation_type = rotationType;
    update.custom_days = rotationType === 'custom' ? (customDays || 7) : null;
  }
  if (pausedFrom !== undefined) update.paused_from = pausedFrom || null;
  if (pausedTo !== undefined) update.paused_to = pausedTo || null;
  if (useHijri !== undefined) update.use_hijri = useHijri;
  if (organizerPhone !== undefined) update.organizer_phone = normalizePhone(organizerPhone);

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

// Get khatma history (past cycles)
router.get('/:id/history', authMiddleware, async (req, res) => {
  try {
    const khatma = req.khatma;
    const cycleNumber = getCycleNumber(
      khatma.start_date, new Date(),
      khatma.paused_from, khatma.paused_to,
      khatma.rotation_type, khatma.custom_days
    );
    const currentCycle = cycleNumber + 1;

    const participants = await Participant.find({ khatma_id: khatma._id }).sort('slot_number');
    const completions = await Completion.find({ khatma_id: khatma._id });
    const deceasedList = await Deceased.find({ khatma_id: khatma._id }).sort('death_date');
    const cycleDays = getCycleDays(khatma.rotation_type, khatma.custom_days);

    const history = [];
    for (let c = 1; c <= currentCycle; c++) {
      const cycleCompletions = completions.filter(comp => comp.cycle_number === c);
      const completedIds = cycleCompletions.map(comp => comp.participant_id.toString());

      const participantsInfo = participants.map(p => ({
        name: p.name,
        slot_number: p.slot_number,
        juz: getCurrentJuz(p.slot_number, c - 1),
        completed: completedIds.includes(p._id.toString())
      }));

      const dedication = getCycleDedication(deceasedList, c - 1, new Date(), cycleDays);

      history.push({
        cycle: c,
        khatmaNumber: (khatma.khatma_number || 1) + c - 1,
        completedCount: cycleCompletions.length,
        totalParticipants: participants.length,
        allCompleted: cycleCompletions.length >= participants.length && participants.length > 0,
        participants: participantsInfo,
        dedication: dedication?.dedicated?.map(d => d.name) || []
      });
    }

    res.json({ history: history.reverse() });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Get statistics
router.get('/:id/stats', authMiddleware, async (req, res) => {
  try {
    const khatma = req.khatma;
    const cycleNumber = getCycleNumber(
      khatma.start_date, new Date(),
      khatma.paused_from, khatma.paused_to,
      khatma.rotation_type, khatma.custom_days
    );
    const currentCycle = cycleNumber + 1;

    const participants = await Participant.find({ khatma_id: khatma._id }).sort('slot_number');
    const completions = await Completion.find({ khatma_id: khatma._id });

    const participantStats = participants.map(p => {
      const pCompletions = completions.filter(c => c.participant_id.toString() === p._id.toString());
      return {
        name: p.name,
        slot_number: p.slot_number,
        completedCycles: pCompletions.length,
        totalCycles: currentCycle,
        rate: currentCycle > 0 ? Math.round((pCompletions.length / currentCycle) * 100) : 0
      };
    });

    // Count fully completed khatmas
    let completedKhatmas = 0;
    for (let c = 1; c <= currentCycle; c++) {
      const cycleCompletions = completions.filter(comp => comp.cycle_number === c);
      if (cycleCompletions.length >= participants.length && participants.length > 0) {
        completedKhatmas++;
      }
    }

    // Current streak
    let streak = 0;
    for (let c = currentCycle; c >= 1; c--) {
      const cycleCompletions = completions.filter(comp => comp.cycle_number === c);
      if (cycleCompletions.length >= participants.length && participants.length > 0) {
        streak++;
      } else {
        break;
      }
    }

    res.json({
      participantStats,
      completedKhatmas,
      totalCycles: currentCycle,
      totalParticipants: participants.length,
      streak
    });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Duplicate Khatma (admin only)
router.post('/:id/duplicate', adminMiddleware, async (req, res) => {
  const { newAccessCode, newAdminPassword } = req.body;

  if (!newAccessCode || !newAdminPassword || typeof newAccessCode !== 'string' || typeof newAdminPassword !== 'string') {
    return res.status(400).json({ error: 'رمز الدخول وكلمة المرور مطلوبان' });
  }

  try {
    const existing = await Khatma.findOne({ access_code: newAccessCode });
    if (existing) {
      return res.status(409).json({ error: 'رمز الدخول مستخدم بالفعل' });
    }

    const khatma = req.khatma;
    const newKhatma = await Khatma.create({
      name: khatma.name + ' (نسخة)',
      access_code: newAccessCode,
      admin_password: newAdminPassword,
      start_date: new Date().toISOString().split('T')[0],
      rotation_type: khatma.rotation_type,
      custom_days: khatma.custom_days,
      use_hijri: khatma.use_hijri,
      khatma_number: khatma.khatma_number,
      is_quick: khatma.is_quick,
      organizer_phone: khatma.organizer_phone || null
    });

    // Quick khatmas start empty: people pick their own juz
    const participants = khatma.is_quick ? [] : await Participant.find({ khatma_id: khatma._id });
    if (participants.length > 0) {
      await Participant.insertMany(participants.map(p => ({
        khatma_id: newKhatma._id,
        name: p.name,
        slot_number: p.slot_number
      })));
    }

    const deceased = await Deceased.find({ khatma_id: khatma._id });
    if (deceased.length > 0) {
      await Deceased.insertMany(deceased.map(d => ({
        khatma_id: newKhatma._id,
        name: d.name,
        death_date: d.death_date
      })));
    }

    res.status(201).json({
      id: newKhatma._id,
      accessCode: newAccessCode,
      message: 'تم نسخ الختمة بنجاح'
    });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Delete Khatma (admin only)
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    await Participant.deleteMany({ khatma_id: req.khatma._id });
    await Deceased.deleteMany({ khatma_id: req.khatma._id });
    await Completion.deleteMany({ khatma_id: req.khatma._id });
    await Khatma.findByIdAndDelete(req.khatma._id);
    res.json({ message: 'تم حذف الختمة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

module.exports = router;
