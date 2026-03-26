const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db/init');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Get all participants
router.get('/', (req, res) => {
  const participants = db.prepare(
    'SELECT * FROM participants WHERE khatma_id = ? ORDER BY slot_number'
  ).all(req.khatma.id);

  res.json(participants);
});

// Add participant
router.post('/', (req, res) => {
  const { name, slotNumber } = req.body;

  if (!name || !slotNumber) {
    return res.status(400).json({ error: 'الاسم ورقم الترتيب مطلوبان' });
  }

  if (slotNumber < 1 || slotNumber > 30) {
    return res.status(400).json({ error: 'رقم الترتيب يجب أن يكون بين 1 و 30' });
  }

  try {
    db.prepare(
      'INSERT INTO participants (khatma_id, name, slot_number) VALUES (?, ?, ?)'
    ).run(req.khatma.id, name, slotNumber);

    res.status(201).json({ message: 'تمت إضافة المشارك بنجاح' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'هذا الترتيب مشغول بالفعل' });
    }
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Update participant
router.put('/:pid', (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'الاسم مطلوب' });
  }

  const result = db.prepare(
    'UPDATE participants SET name = ? WHERE id = ? AND khatma_id = ?'
  ).run(name, req.params.pid, req.khatma.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'المشارك غير موجود' });
  }

  res.json({ message: 'تم التحديث بنجاح' });
});

// Delete participant
router.delete('/:pid', (req, res) => {
  const result = db.prepare(
    'DELETE FROM participants WHERE id = ? AND khatma_id = ?'
  ).run(req.params.pid, req.khatma.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'المشارك غير موجود' });
  }

  res.json({ message: 'تم حذف المشارك بنجاح' });
});

module.exports = router;
