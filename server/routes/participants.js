const express = require('express');
const router = express.Router({ mergeParams: true });
const { db } = require('../db/init');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Get all participants
router.get('/', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM participants WHERE khatma_id = ? ORDER BY slot_number',
      args: [req.khatma.id]
    });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Add participant
router.post('/', async (req, res) => {
  const { name, slotNumber } = req.body;

  if (!name || !slotNumber) {
    return res.status(400).json({ error: 'الاسم ورقم الترتيب مطلوبان' });
  }

  if (slotNumber < 1 || slotNumber > 30) {
    return res.status(400).json({ error: 'رقم الترتيب يجب أن يكون بين 1 و 30' });
  }

  try {
    await db.execute({
      sql: 'INSERT INTO participants (khatma_id, name, slot_number) VALUES (?, ?, ?)',
      args: [req.khatma.id, name, slotNumber]
    });
    res.status(201).json({ message: 'تمت إضافة المشارك بنجاح' });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'هذا الترتيب مشغول بالفعل' });
    }
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Update participant
router.put('/:pid', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'الاسم مطلوب' });
  }

  try {
    const result = await db.execute({
      sql: 'UPDATE participants SET name = ? WHERE id = ? AND khatma_id = ?',
      args: [name, req.params.pid, req.khatma.id]
    });

    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'المشارك غير موجود' });
    }
    res.json({ message: 'تم التحديث بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Delete participant
router.delete('/:pid', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'DELETE FROM participants WHERE id = ? AND khatma_id = ?',
      args: [req.params.pid, req.khatma.id]
    });

    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'المشارك غير موجود' });
    }
    res.json({ message: 'تم حذف المشارك بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

module.exports = router;
