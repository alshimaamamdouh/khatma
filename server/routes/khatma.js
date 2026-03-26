const express = require('express');
const router = express.Router();
const { db } = require('../db/init');
const authMiddleware = require('../middleware/auth');
const { getWeekNumber, getCurrentJuz, getWeekDedication } = require('../utils/rotation');

// Access a Khatma by code
router.post('/access', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'الرجاء إدخال رمز الختمة' });
  }

  try {
    const khatmaResult = await db.execute({
      sql: 'SELECT * FROM khatma WHERE access_code = ?',
      args: [code]
    });

    if (khatmaResult.rows.length === 0) {
      return res.status(404).json({ error: 'رمز الختمة غير صحيح' });
    }

    const khatma = khatmaResult.rows[0];

    const participantsResult = await db.execute({
      sql: 'SELECT * FROM participants WHERE khatma_id = ? ORDER BY slot_number',
      args: [khatma.id]
    });

    res.json({ khatma, participants: participantsResult.rows });
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
    const existing = await db.execute({
      sql: 'SELECT id FROM khatma WHERE access_code = ?',
      args: [accessCode]
    });

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'رمز الدخول مستخدم بالفعل، اختر رمزاً آخر' });
    }

    const result = await db.execute({
      sql: 'INSERT INTO khatma (name, access_code, start_date) VALUES (?, ?, ?)',
      args: [name, accessCode, startDate]
    });

    const khatmaId = Number(result.lastInsertRowid);

    if (participants && participants.length > 0) {
      for (const p of participants) {
        await db.execute({
          sql: 'INSERT INTO participants (khatma_id, name, slot_number) VALUES (?, ?, ?)',
          args: [khatmaId, p.name, p.slotNumber]
        });
      }
    }

    if (deceased && deceased.length > 0) {
      for (const d of deceased) {
        await db.execute({
          sql: 'INSERT INTO deceased (khatma_id, name, death_date) VALUES (?, ?, ?)',
          args: [khatmaId, d.name, d.deathDate]
        });
      }
    }

    res.status(201).json({ id: khatmaId, message: 'تم إنشاء الختمة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الختمة' });
  }
});

// Get dashboard data
router.get('/:id/dashboard', authMiddleware, async (req, res) => {
  try {
    const khatma = req.khatma;
    const weekNumber = getWeekNumber(khatma.start_date);

    const participantsResult = await db.execute({
      sql: 'SELECT * FROM participants WHERE khatma_id = ? ORDER BY slot_number',
      args: [khatma.id]
    });

    const deceasedResult = await db.execute({
      sql: 'SELECT * FROM deceased WHERE khatma_id = ? ORDER BY death_date',
      args: [khatma.id]
    });

    const participantsWithJuz = participantsResult.rows.map(p => ({
      ...p,
      currentJuz: getCurrentJuz(p.slot_number, weekNumber)
    }));

    const dedication = getWeekDedication(deceasedResult.rows, weekNumber);

    res.json({
      khatma,
      weekNumber: weekNumber + 1,
      participants: participantsWithJuz,
      dedication,
      deceased: deceasedResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Update Khatma
router.put('/:id', authMiddleware, async (req, res) => {
  const { name, startDate } = req.body;
  const khatma = req.khatma;

  const updates = [];
  const values = [];

  if (name) { updates.push('name = ?'); values.push(name); }
  if (startDate) { updates.push('start_date = ?'); values.push(startDate); }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'لا توجد بيانات للتحديث' });
  }

  try {
    values.push(khatma.id);
    await db.execute({
      sql: `UPDATE khatma SET ${updates.join(', ')} WHERE id = ?`,
      args: values
    });
    res.json({ message: 'تم التحديث بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

module.exports = router;
