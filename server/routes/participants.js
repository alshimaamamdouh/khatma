const express = require('express');
const mongoose = require('mongoose');
const { newToken } = require('../utils/token');
const router = express.Router({ mergeParams: true });
const Participant = require('../models/Participant');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const isId = id => mongoose.Types.ObjectId.isValid(id) && String(id).length === 24;

// Get all participants (any authenticated user)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const participants = await Participant.find({ khatma_id: req.khatma._id }).sort('slot_number');
    res.json(participants);
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Add participant (admin only)
router.post('/', adminMiddleware, async (req, res) => {
  const { name, slotNumber } = req.body;

  if (!name || typeof name !== 'string' || !slotNumber) {
    return res.status(400).json({ error: 'الاسم ورقم الترتيب مطلوبان' });
  }

  if (!Number.isInteger(slotNumber) || slotNumber < 1 || slotNumber > 30) {
    return res.status(400).json({ error: 'رقم الترتيب يجب أن يكون بين 1 و 30' });
  }

  try {
    const participant = await Participant.create({
      khatma_id: req.khatma._id,
      name,
      slot_number: slotNumber
    });
    res.status(201).json({ message: 'تمت إضافة المشارك بنجاح', participant });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'هذا الترتيب مشغول بالفعل' });
    }
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Update participant (admin only)
router.put('/:pid', adminMiddleware, async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'الاسم مطلوب' });
  }
  if (!isId(req.params.pid)) {
    return res.status(404).json({ error: 'المشارك غير موجود' });
  }

  try {
    const result = await Participant.findOneAndUpdate(
      { _id: req.params.pid, khatma_id: req.khatma._id },
      { name },
      { returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ error: 'المشارك غير موجود' });
    }
    res.json({ message: 'تم التحديث بنجاح', participant: result });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Swap participant slot numbers (admin only)
router.put('/:pid/swap', adminMiddleware, async (req, res) => {
  const { targetPid } = req.body;

  if (!targetPid) {
    return res.status(400).json({ error: 'المشارك الهدف مطلوب' });
  }
  if (!isId(req.params.pid) || !isId(targetPid)) {
    return res.status(404).json({ error: 'المشارك غير موجود' });
  }

  try {
    const p1 = await Participant.findOne({ _id: req.params.pid, khatma_id: req.khatma._id });
    const p2 = await Participant.findOne({ _id: targetPid, khatma_id: req.khatma._id });

    if (!p1 || !p2) {
      return res.status(404).json({ error: 'المشارك غير موجود' });
    }

    const tempSlot = 999;
    await Participant.findByIdAndUpdate(p1._id, { slot_number: tempSlot });
    await Participant.findByIdAndUpdate(p2._id, { slot_number: p1.slot_number });
    await Participant.findByIdAndUpdate(p1._id, { slot_number: p2.slot_number });

    res.json({ message: 'تم تبديل الترتيب بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Delete participant (admin only)
router.delete('/:pid', adminMiddleware, async (req, res) => {
  if (!isId(req.params.pid)) {
    return res.status(404).json({ error: 'المشارك غير موجود' });
  }
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

// Claim a name on this phone (any participant with the khatma link). Returns that participant's token.
router.post('/:pid/claim', authMiddleware, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.pid)) {
    return res.status(404).json({ error: 'المشارك غير موجود' });
  }

  try {
    // Only set a token if none exists, so two phones claiming at once get the same token
    await Participant.updateOne(
      { _id: req.params.pid, khatma_id: req.khatma._id, token: null },
      { token: newToken() }
    );
    const participant = await Participant.findOne({ _id: req.params.pid, khatma_id: req.khatma._id }).select('+token');

    if (!participant) {
      return res.status(404).json({ error: 'المشارك غير موجود' });
    }
    res.json({ participantId: participant._id, token: participant.token });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

module.exports = router;
