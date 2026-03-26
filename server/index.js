const express = require('express');
const cors = require('cors');
const path = require('path');

const khatmaRoutes = require('./routes/khatma');
const participantRoutes = require('./routes/participants');
const deceasedRoutes = require('./routes/deceased');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/khatma', khatmaRoutes);
app.use('/api/khatma/:id/participants', participantRoutes);
app.use('/api/khatma/:id/deceased', deceasedRoutes);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
