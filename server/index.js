const express = require('express');
const cors = require('cors');
const { connectDB } = require('./db/init');

const khatmaRoutes = require('./routes/khatma');
const participantRoutes = require('./routes/participants');
const deceasedRoutes = require('./routes/deceased');

const app = express();

app.use(cors());
app.use(express.json());

// Connect to MongoDB before handling requests
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الاتصال بقاعدة البيانات' });
  }
});

// API routes
app.use('/api/khatma', khatmaRoutes);
app.use('/api/khatma/:id/participants', participantRoutes);
app.use('/api/khatma/:id/deceased', deceasedRoutes);

// Health check
app.get('/api', (req, res) => {
  res.json({ status: 'ok', message: 'Khatma API is running' });
});

// Local dev server
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
