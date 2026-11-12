// server.js
// Local development & production server for MotoCare
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const apiRouter = require('./api/index.js');

const app = express();
const PORT = process.env.PORT || 3002;

// Mount the API router
app.use(apiRouter);

// Serve static files from root directory
app.use(express.static(__dirname));

// Serve files from lib folder specifically if requested
app.use('/lib', express.static(path.join(__dirname, 'lib')));

// Fallback for single page app (SPA) routing: serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 MotoCare server berjalan di http://localhost:${PORT}/`);
  console.log(`📡 Database URL terdeteksi: ${process.env.DATABASE_URL ? 'YA (Terkonfigurasi)' : 'TIDAK (Belum terisi di .env)'}`);
});
