const express = require('express');
const router = express.Router({ mergeParams: true });
const Completion = require('../models/Completion');
const Participant = require('../models/Participant');
const mongoose = require('mongoose');
const { authMiddleware, canActFor } = require('../middleware/auth');

router.use(authMiddleware);

// Mark juz as completed (own juz with participant token, or anyone as organizer). Safe to repeat.
router.post('/', async (req, res) => {
  const { participantId, cycleNumber } = req.body;

  if (!participantId || !cycleNumber || !mongoose.Types.ObjectId.isValid(participantId)) {
    return res.status(400).json({ error: 'بيانات غير مكتملة' });
  }

  try {
    const participant = await Participant.findOne({ _id: participantId, khatma_id: req.khatma._id });
    if (!participant) {
      return res.status(404).json({ error: 'المشارك غير موجود' });
    }

    if (!(await canActFor(req, participantId))) {
      return res.status(403).json({ error: 'يمكنك تسجيل قراءتك أنت فقط' });
    }

    try {
      await Completion.updateOne(
        { khatma_id: req.khatma._id, participant_id: participantId, cycle_number: cycleNumber },
        { $setOnInsert: { completed_at: new Date() } },
        { upsert: true }
      );
    } catch (err) {
      // A simultaneous identical request already inserted it — same end state
      if (err.code !== 11000) throw err;
    }

    const totalParticipants = await Participant.countDocuments({ khatma_id: req.khatma._id });
    const completedCount = await Completion.countDocuments({ khatma_id: req.khatma._id, cycle_number: cycleNumber });

    res.json({
      message: 'تم تسجيل الإنجاز',
      completedCount,
      totalParticipants,
      allCompleted: completedCount >= totalParticipants
    });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Undo completion (same permissions as marking). Safe to repeat.
router.delete('/', async (req, res) => {
  const { participantId, cycleNumber } = req.body;

  if (!participantId || !cycleNumber || !mongoose.Types.ObjectId.isValid(participantId)) {
    return res.status(400).json({ error: 'بيانات غير مكتملة' });
  }

  try {
    if (!(await canActFor(req, participantId))) {
      return res.status(403).json({ error: 'يمكنك تعديل قراءتك أنت فقط' });
    }

    await Completion.deleteOne({
      khatma_id: req.khatma._id,
      participant_id: participantId,
      cycle_number: cycleNumber
    });
    res.json({ message: 'تم إلغاء الإنجاز' });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Get completion status for current cycle
router.get('/:cycleNumber', async (req, res) => {
  try {
    const cycleNumber = Number(req.params.cycleNumber);
    const totalParticipants = await Participant.countDocuments({ khatma_id: req.khatma._id });
    const completions = await Completion.find({
      khatma_id: req.khatma._id,
      cycle_number: cycleNumber
    });

    const completedIds = completions.map(c => c.participant_id.toString());
    const allCompleted = completedIds.length >= totalParticipants;

    res.json({
      completedIds,
      completedCount: completedIds.length,
      totalParticipants,
      allCompleted
    });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

module.exports = router;
