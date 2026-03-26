const mongoose = require('mongoose');

const deceasedSchema = new mongoose.Schema({
  khatma_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Khatma', required: true },
  name: { type: String, required: true },
  death_date: { type: String, required: true }
});

module.exports = mongoose.model('Deceased', deceasedSchema);
