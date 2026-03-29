const mongoose = require('mongoose');

const khatmaSchema = new mongoose.Schema({
  name: { type: String, required: true },
  access_code: { type: String, required: true, unique: true },
  admin_password: { type: String, required: true },
  start_date: { type: String, required: true },
  rotation_type: { type: String, default: 'weekly', enum: ['daily', 'weekly', 'biweekly', 'monthly', 'custom'] },
  custom_days: { type: Number, default: null },
  paused_from: { type: String, default: null },
  paused_to: { type: String, default: null },
  is_quick: { type: Boolean, default: false },
  khatma_number: { type: Number, default: 1 },
  use_hijri: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Khatma', khatmaSchema);
