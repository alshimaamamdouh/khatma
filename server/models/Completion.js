const mongoose = require('mongoose');

const completionSchema = new mongoose.Schema({
  khatma_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Khatma', required: true },
  participant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Participant', required: true },
  cycle_number: { type: Number, required: true },
  completed_at: { type: Date, default: Date.now }
});

completionSchema.index({ khatma_id: 1, participant_id: 1, cycle_number: 1 }, { unique: true });

module.exports = mongoose.model('Completion', completionSchema);
