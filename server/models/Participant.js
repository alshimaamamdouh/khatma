const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  khatma_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Khatma', required: true },
  name: { type: String, required: true },
  slot_number: { type: Number, required: true }
});

participantSchema.index({ khatma_id: 1, slot_number: 1 }, { unique: true });

module.exports = mongoose.model('Participant', participantSchema);
