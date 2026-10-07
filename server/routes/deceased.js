const express = require('express');
const mongoose = require('mongoose');
const router = express.Router({ mergeParams: true });
const isId = id => mongoose.Types.ObjectId.isValid(id) && String(id).length === 24;
const Deceased = require('../models/Deceased');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Get all deceased (any authenticated user)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const deceased = await Deceased.find({ khatma_id: req.khatma._id }).sort('death_date');
    res.json(deceased);
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Add deceased (admin only)
router.post('/', adminMiddleware, async (req, res) => {
  const { name, deathDate } = req.body;

  if (!name || !deathDate || typeof name !== 'string' || typeof deathDate !== 'string') {
    return res.status(400).json({ error: 'الاسم وتاريخ الوفاة مطلوبان' });
  }

  try {
    const deceased = await Deceased.create({
      khatma_id: req.khatma._id,
      name,
      death_date: deathDate
    });
    res.status(201).json({ message: 'تمت الإضافة بنجاح', deceased });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Update deceased (admin only)
router.put('/:did', adminMiddleware, async (req, res) => {
  const { name, deathDate } = req.body;
  const update = {};

  if ((name != null && typeof name !== 'string') || (deathDate != null && typeof deathDate !== 'string')) {
    return res.status(400).json({ error: 'بيانات غير صحيحة' });
  }
  if (!isId(req.params.did)) {
    return res.status(404).json({ error: 'السجل غير موجود' });
  }

  if (name) update.name = name;
  if (deathDate) update.death_date = deathDate;

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: 'لا توجد بيانات للتحديث' });
  }

  try {
    const result = await Deceased.findOneAndUpdate(
      { _id: req.params.did, khatma_id: req.khatma._id },
      update,
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ error: 'السجل غير موجود' });
    }
    res.json({ message: 'تم التحديث بنجاح', deceased: result });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Delete deceased (admin only)
router.delete('/:did', adminMiddleware, async (req, res) => {
  if (!isId(req.params.did)) {
    return res.status(404).json({ error: 'السجل غير موجود' });
  }
  try {
    const result = await Deceased.findOneAndDelete({
      _id: req.params.did,
      khatma_id: req.khatma._id
    });

    if (!result) {
      return res.status(404).json({ error: 'السجل غير موجود' });
    }
    res.json({ message: 'تم الحذف بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

module.exports = router;
