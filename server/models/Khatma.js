const mongoose = require('mongoose');

const khatmaSchema = new mongoose.Schema({
  name: { type: String, required: true },
  access_code: { type: String, required: true, unique: true },
  start_date: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Khatma', khatmaSchema);
