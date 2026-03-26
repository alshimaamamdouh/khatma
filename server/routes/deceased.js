const express = require('express');
const router = express.Router({ mergeParams: true });
const Deceased = require('../models/Deceased');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Get all deceased
router.get('/', async (req, res) => {
  try {
    const deceased = await Deceased.find({ khatma_id: req.khatma._id }).sort('death_date');
    res.json(deceased);
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
    await Deceased.create({
      khatma_id: req.khatma._id,
      name,
      death_date: deathDate
    });
    res.status(201).json({ message: 'تمت الإضافة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Update deceased
router.put('/:did', async (req, res) => {
  const { name, deathDate } = req.body;
  const update = {};

  if (name) update.name = name;
  if (deathDate) update.death_date = deathDate;

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: 'لا توجد بيانات للتحديث' });
  }

  try {
    const result = await Deceased.findOneAndUpdate(
      { _id: req.params.did, khatma_id: req.khatma._id },
      update
    );

    if (!result) {
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
