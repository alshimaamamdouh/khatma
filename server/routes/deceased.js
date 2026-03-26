const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db/init');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Get all deceased
router.get('/', (req, res) => {
  const deceased = db.prepare(
    'SELECT * FROM deceased WHERE khatma_id = ? ORDER BY death_date'
  ).all(req.khatma.id);

  res.json(deceased);
});

// Add deceased
router.post('/', (req, res) => {
  const { name, deathDate } = req.body;

  if (!name || !deathDate) {
    return res.status(400).json({ error: 'الاسم وتاريخ الوفاة مطلوبان' });
  }

  try {
    db.prepare(
      'INSERT INTO deceased (khatma_id, name, death_date) VALUES (?, ?, ?)'
    ).run(req.khatma.id, name, deathDate);

    res.status(201).json({ message: 'تمت الإضافة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Update deceased
router.put('/:did', (req, res) => {
  const { name, deathDate } = req.body;

  const updates = [];
  const values = [];

  if (name) { updates.push('name = ?'); values.push(name); }
  if (deathDate) { updates.push('death_date = ?'); values.push(deathDate); }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'لا توجد بيانات للتحديث' });
  }

  values.push(req.params.did, req.khatma.id);
  const result = db.prepare(
    `UPDATE deceased SET ${updates.join(', ')} WHERE id = ? AND khatma_id = ?`
  ).run(...values);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'السجل غير موجود' });
  }

  res.json({ message: 'تم التحديث بنجاح' });
});

// Delete deceased
router.delete('/:did', (req, res) => {
  const result = db.prepare(
    'DELETE FROM deceased WHERE id = ? AND khatma_id = ?'
  ).run(req.params.did, req.khatma.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'السجل غير موجود' });
  }

  res.json({ message: 'تم الحذف بنجاح' });
});

module.exports = router;
