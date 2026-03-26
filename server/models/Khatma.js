const mongoose = require('mongoose');

const khatmaSchema = new mongoose.Schema({
  name: { type: String, required: true },
  access_code: { type: String, required: true, unique: true },
  admin_password: { type: String, required: true },
  start_date: { type: String, required: true },
  paused_from: { type: String, default: null },
  paused_to: { type: String, default: null },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Khatma', khatmaSchema);
