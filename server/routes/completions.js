const express = require('express');
const router = express.Router({ mergeParams: true });
const Completion = require('../models/Completion');
const Participant = require('../models/Participant');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Mark juz as completed
router.post('/', async (req, res) => {
  const { participantId, cycleNumber } = req.body;

  if (!participantId || !cycleNumber) {
    return res.status(400).json({ error: 'بيانات غير مكتملة' });
  }

  try {
    // Verify participant belongs to this khatma
    const participant = await Participant.findOne({
      _id: participantId,
      khatma_id: req.khatma._id
    });

    if (!participant) {
      return res.status(404).json({ error: 'المشارك غير موجود' });
    }

    await Completion.create({
      khatma_id: req.khatma._id,
      participant_id: participantId,
      cycle_number: cycleNumber
    });

    // Check if all participants completed
    const totalParticipants = await Participant.countDocuments({ khatma_id: req.khatma._id });
    const completedCount = await Completion.countDocuments({
      khatma_id: req.khatma._id,
      cycle_number: cycleNumber
    });

    const allCompleted = completedCount >= totalParticipants;

    res.status(201).json({
      message: 'تم تسجيل الإنجاز',
      completedCount,
      totalParticipants,
      allCompleted
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'تم تسجيل إنجازك مسبقاً' });
    }
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Undo completion
router.delete('/', async (req, res) => {
  const { participantId, cycleNumber } = req.body;

  try {
    await Completion.findOneAndDelete({
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
