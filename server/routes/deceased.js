const express = require('express');
const router = express.Router({ mergeParams: true });
const { db } = require('../db/init');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Get all deceased
router.get('/', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM deceased WHERE khatma_id = ? ORDER BY death_date',
      args: [req.khatma.id]
    });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Add deceased
router.post('/', async (req, res) => {
  const { name, deathDate } = req.body;

  if (!name || !deathDate) {
    return res.status(400).json({ error: 'الاسم وتاريخ الوفاة مطلوبان' });
  }

  try {
    await db.execute({
      sql: 'INSERT INTO deceased (khatma_id, name, death_date) VALUES (?, ?, ?)',
      args: [req.khatma.id, name, deathDate]
    });
    res.status(201).json({ message: 'تمت الإضافة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Update deceased
router.put('/:did', async (req, res) => {
  const { name, deathDate } = req.body;

  const updates = [];
  const values = [];

  if (name) { updates.push('name = ?'); values.push(name); }
  if (deathDate) { updates.push('death_date = ?'); values.push(deathDate); }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'لا توجد بيانات للتحديث' });
  }

  try {
    values.push(req.params.did, req.khatma.id);
    const result = await db.execute({
      sql: `UPDATE deceased SET ${updates.join(', ')} WHERE id = ? AND khatma_id = ?`,
      args: values
    });

    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'السجل غير موجود' });
    }
    res.json({ message: 'تم التحديث بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Delete deceased
router.delete('/:did', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'DELETE FROM deceased WHERE id = ? AND khatma_id = ?',
      args: [req.params.did, req.khatma.id]
    });

    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'السجل غير موجود' });
    }
    res.json({ message: 'تم الحذف بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

module.exports = router;
