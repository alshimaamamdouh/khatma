const express = require('express');
const router = express.Router();
const Khatma = require('../models/Khatma');
const Participant = require('../models/Participant');
const Deceased = require('../models/Deceased');
const authMiddleware = require('../middleware/auth');
const { getWeekNumber, getCurrentJuz, getWeekDedication } = require('../utils/rotation');

// Access a Khatma by code
router.post('/access', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'الرجاء إدخال رمز الختمة' });
  }

  try {
    const khatma = await Khatma.findOne({ access_code: code });
    if (!khatma) {
      return res.status(404).json({ error: 'رمز الختمة غير صحيح' });
    }

    const participants = await Participant.find({ khatma_id: khatma._id }).sort('slot_number');

    res.json({ khatma, participants });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Create a new Khatma
router.post('/', async (req, res) => {
  const { name, accessCode, startDate, participants, deceased } = req.body;

  if (!name || !accessCode || !startDate) {
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
      start_date: startDate
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

// Get dashboard data
router.get('/:id/dashboard', authMiddleware, async (req, res) => {
  try {
    const khatma = req.khatma;
    const weekNumber = getWeekNumber(khatma.start_date);

    const participants = await Participant.find({ khatma_id: khatma._id }).sort('slot_number');
    const deceasedList = await Deceased.find({ khatma_id: khatma._id }).sort('death_date');

    const participantsWithJuz = participants.map(p => ({
      _id: p._id,
      khatma_id: p.khatma_id,
      name: p.name,
      slot_number: p.slot_number,
      currentJuz: getCurrentJuz(p.slot_number, weekNumber)
    }));

    const dedication = getWeekDedication(deceasedList, weekNumber);

    res.json({
      khatma,
      weekNumber: weekNumber + 1,
      participants: participantsWithJuz,
      dedication,
      deceased: deceasedList
    });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Update Khatma
router.put('/:id', authMiddleware, async (req, res) => {
  const { name, startDate } = req.body;
  const update = {};

  if (name) update.name = name;
  if (startDate) update.start_date = startDate;

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

module.exports = router;
