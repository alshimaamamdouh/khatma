const express = require('express');
const router = express.Router();
const db = require('../db/init');
const authMiddleware = require('../middleware/auth');
const { getWeekNumber, getCurrentJuz, getWeekDedication } = require('../utils/rotation');

// Access a Khatma by code
router.post('/access', (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'الرجاء إدخال رمز الختمة' });
  }

  const khatma = db.prepare('SELECT * FROM khatma WHERE access_code = ?').get(code);
  if (!khatma) {
    return res.status(404).json({ error: 'رمز الختمة غير صحيح' });
  }

  const participants = db.prepare(
    'SELECT * FROM participants WHERE khatma_id = ? ORDER BY slot_number'
  ).all(khatma.id);

  res.json({ khatma, participants });
});

// Create a new Khatma
router.post('/', (req, res) => {
  const { name, accessCode, startDate, participants, deceased } = req.body;

  if (!name || !accessCode || !startDate) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
  }

  // Check if access code is taken
  const existing = db.prepare('SELECT id FROM khatma WHERE access_code = ?').get(accessCode);
  if (existing) {
    return res.status(409).json({ error: 'رمز الدخول مستخدم بالفعل، اختر رمزاً آخر' });
  }

  const insertKhatma = db.prepare(
    'INSERT INTO khatma (name, access_code, start_date) VALUES (?, ?, ?)'
  );
  const insertParticipant = db.prepare(
    'INSERT INTO participants (khatma_id, name, slot_number) VALUES (?, ?, ?)'
  );
  const insertDeceased = db.prepare(
    'INSERT INTO deceased (khatma_id, name, death_date) VALUES (?, ?, ?)'
  );

  const transaction = db.transaction(() => {
    const result = insertKhatma.run(name, accessCode, startDate);
    const khatmaId = result.lastInsertRowid;

    if (participants && participants.length > 0) {
      for (const p of participants) {
        insertParticipant.run(khatmaId, p.name, p.slotNumber);
      }
    }

    if (deceased && deceased.length > 0) {
      for (const d of deceased) {
        insertDeceased.run(khatmaId, d.name, d.deathDate);
      }
    }

    return khatmaId;
  });

  try {
    const khatmaId = transaction();
    res.status(201).json({ id: khatmaId, message: 'تم إنشاء الختمة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الختمة' });
  }
});

// Get dashboard data
router.get('/:id/dashboard', authMiddleware, (req, res) => {
  const khatma = req.khatma;
  const weekNumber = getWeekNumber(khatma.start_date);

  const participants = db.prepare(
    'SELECT * FROM participants WHERE khatma_id = ? ORDER BY slot_number'
  ).all(khatma.id);

  const deceasedList = db.prepare(
    'SELECT * FROM deceased WHERE khatma_id = ? ORDER BY death_date'
  ).all(khatma.id);

  const participantsWithJuz = participants.map(p => ({
    ...p,
    currentJuz: getCurrentJuz(p.slot_number, weekNumber)
  }));

  const dedication = getWeekDedication(deceasedList, weekNumber);

  res.json({
    khatma,
    weekNumber: weekNumber + 1, // 1-indexed for display
    participants: participantsWithJuz,
    dedication,
    deceased: deceasedList
  });
});

// Update Khatma
router.put('/:id', authMiddleware, (req, res) => {
  const { name, startDate } = req.body;
  const khatma = req.khatma;

  const updates = [];
  const values = [];

  if (name) { updates.push('name = ?'); values.push(name); }
  if (startDate) { updates.push('start_date = ?'); values.push(startDate); }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'لا توجد بيانات للتحديث' });
  }

  values.push(khatma.id);
  db.prepare(`UPDATE khatma SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  res.json({ message: 'تم التحديث بنجاح' });
});

module.exports = router;
