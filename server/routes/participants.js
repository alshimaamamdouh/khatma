const express = require('express');
const router = express.Router({ mergeParams: true });
const Participant = require('../models/Participant');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Get all participants
router.get('/', async (req, res) => {
  try {
    const participants = await Participant.find({ khatma_id: req.khatma._id }).sort('slot_number');
    res.json(participants);
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
    await Participant.create({
      khatma_id: req.khatma._id,
      name,
      slot_number: slotNumber
    });
    res.status(201).json({ message: 'تمت إضافة المشارك بنجاح' });
  } catch (err) {
    if (err.code === 11000) {
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
    const result = await Participant.findOneAndUpdate(
      { _id: req.params.pid, khatma_id: req.khatma._id },
      { name }
    );

    if (!result) {
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
    const result = await Participant.findOneAndDelete({
      _id: req.params.pid,
      khatma_id: req.khatma._id
    });

    if (!result) {
      return res.status(404).json({ error: 'المشارك غير موجود' });
    }
    res.json({ message: 'تم حذف المشارك بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

module.exports = router;
