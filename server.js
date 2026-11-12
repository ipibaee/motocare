// server.js
// Local development & production server for MotoCare
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const apiRouter = require('./api/index.js');
const { Pool } = require('pg');

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

app.listen(PORT, async () => {
  console.log(`🚀 MotoCare server berjalan di http://localhost:${PORT}/`);
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL tidak ditemukan di .env! Mohon buat file .env');
    return;
  }
  console.log(`📡 Menghubungkan ke database: ${dbUrl.replace(/:[^:@]+@/, ':****@')}`);
  try {
    const isLocal = dbUrl.includes('127.0.0.1') || dbUrl.includes('localhost');
    const p = new Pool({ connectionString: dbUrl, ssl: isLocal ? false : { rejectUnauthorized: false } });
    const res = await p.query('SELECT current_database(), current_user');
    console.log(`✅ Berhasil terhubung ke database "${res.rows[0].current_database}" sebagai user "${res.rows[0].current_user}"`);
    p.end();
  } catch (err) {
    console.error(`❌ Gagal koneksi database saat startup: ${err.message}`);
  }
});
