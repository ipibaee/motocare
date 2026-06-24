// api/index.js
// Express API backend for MotoCare - Neon PostgreSQL & Auth integration
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET || 'motocare_default_jwt_secret_key_123!';

// Setup PostgreSQL pool with SSL enabled for Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

let dbInitialized = false;
let dbInitWarned = false;

// Database schema initialization helper
const initializeDbSchema = async () => {
  if (dbInitialized) return;
  if (!process.env.DATABASE_URL) {
    if (!dbInitWarned) {
      console.warn("DATABASE_URL environment variable is missing. Neon database integration is disabled.");
      dbInitWarned = true;
    }
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Create Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        avatar_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Vehicles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        brand VARCHAR(255),
        model VARCHAR(255),
        plate_number VARCHAR(255),
        year INTEGER,
        current_odometer INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Components table
    await client.query(`
      CREATE TABLE IF NOT EXISTS components (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        icon VARCHAR(255),
        interval_km INTEGER NOT NULL,
        interval_days INTEGER,
        last_service_odometer INTEGER DEFAULT 0,
        last_service_date DATE,
        is_custom BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Service History table
    await client.query(`
      CREATE TABLE IF NOT EXISTS service_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
        service_date DATE NOT NULL,
        odometer INTEGER DEFAULT 0,
        cost NUMERIC(12, 2) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Service History Components join table
    await client.query(`
      CREATE TABLE IF NOT EXISTS service_history_components (
        id SERIAL PRIMARY KEY,
        service_history_id INTEGER REFERENCES service_history(id) ON DELETE CASCADE,
        component_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Workshops table
    await client.query(`
      CREATE TABLE IF NOT EXISTS workshops (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        phone VARCHAR(255),
        category VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        theme VARCHAR(255) DEFAULT 'dark',
        notification_enabled BOOLEAN DEFAULT true,
        tracking_enabled BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query('COMMIT');
    dbInitialized = true;
    console.log("MotoCare Neon PostgreSQL schema initialized successfully!");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Failed to initialize database schema:", err);
  } finally {
    client.release();
  }
};

// Middleware to ensure DB schema is initialized on request
app.use(async (req, res, next) => {
  try {
    await initializeDbSchema();
    next();
  } catch (err) {
    console.error("DB check middleware error:", err);
    res.status(500).json({ error: "Database initialization error" });
  }
});

// Authentication middleware
const requireAuth = (req, res, next) => {
  const token = req.cookies.motocare_session;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized. Session not found." });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized. Invalid session token." });
  }
};

// ----------------------------------------------------
// AUTH ENDPOINTS
// ----------------------------------------------------

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Semua field (nama, email, password) wajib diisi." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password minimal harus 6 karakter." });
  }

  try {
    // Check if email already exists
    const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: "Email sudah terdaftar. Silakan gunakan email lain." });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    const insertRes = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, avatar_url',
      [name.trim(), email.toLowerCase().trim(), passwordHash]
    );
    const user = insertRes.rows[0];

    // Create default settings for the user
    await pool.query('INSERT INTO settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);

    // Create session token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    // Set cookie
    res.cookie('motocare_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    return res.status(201).json({ user });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Terjadi kesalahan server saat pendaftaran." });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email dan password wajib diisi." });
  }

  try {
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (userRes.rows.length === 0) {
      return res.status(400).json({ error: "Email atau password salah." });
    }

    const user = userRes.rows[0];
    const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordMatch) {
      return res.status(400).json({ error: "Email atau password salah." });
    }

    // Create session token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    // Set cookie
    res.cookie('motocare_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    return res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Terjadi kesalahan server saat masuk." });
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('motocare_session');
  return res.status(200).json({ success: true });
});

// GET /api/me
app.get('/api/me', async (req, res) => {
  const token = req.cookies.motocare_session;
  if (!token) {
    return res.status(200).json({ user: null });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userRes = await pool.query('SELECT id, name, email, avatar_url FROM users WHERE id = $1', [decoded.userId]);
    if (userRes.rows.length === 0) {
      res.clearCookie('motocare_session');
      return res.status(200).json({ user: null });
    }
    return res.status(200).json({ user: userRes.rows[0] });
  } catch (err) {
    res.clearCookie('motocare_session');
    return res.status(200).json({ user: null });
  }
});

// PUT /api/me/profile
app.put('/api/me/profile', requireAuth, async (req, res) => {
  const { name, avatar_base64 } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Nama tidak boleh kosong." });
  }
  try {
    if (avatar_base64) {
      await pool.query(
        'UPDATE users SET name = $1, avatar_url = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [name, avatar_base64, req.userId]
      );
    } else {
      await pool.query(
        'UPDATE users SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [name, req.userId]
      );
    }
    const userRes = await pool.query('SELECT id, name, email, avatar_url FROM users WHERE id = $1', [req.userId]);
    return res.status(200).json({ user: userRes.rows[0] });
  } catch (err) {
    console.error("Profile update error:", err);
    return res.status(500).json({ error: "Terjadi kesalahan server saat memperbarui profil." });
  }
});

// DELETE /api/me
app.delete('/api/me', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.userId]);
    res.clearCookie('motocare_session');
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Account delete error:", err);
    return res.status(500).json({ error: "Gagal menghapus akun." });
  }
});

// ----------------------------------------------------
// VEHICLES ENDPOINTS
// ----------------------------------------------------

// GET /api/vehicles
app.get('/api/vehicles', requireAuth, async (req, res) => {
  try {
    const vehs = await pool.query('SELECT * FROM vehicles WHERE user_id = $1 ORDER BY created_at ASC', [req.userId]);
    return res.status(200).json(vehs.rows);
  } catch (err) {
    console.error("Get vehicles error:", err);
    return res.status(500).json({ error: "Gagal mengambil data kendaraan." });
  }
});

// POST /api/vehicles
app.post('/api/vehicles', requireAuth, async (req, res) => {
  const { name, brand, model, plate_number, year, current_odometer, is_active } = req.body;
  if (!name) return res.status(400).json({ error: "Nama kendaraan wajib diisi." });

  try {
    // If setting active, deactivate others first
    if (is_active) {
      await pool.query('UPDATE vehicles SET is_active = false WHERE user_id = $1', [req.userId]);
    }
    const insertRes = await pool.query(
      `INSERT INTO vehicles (user_id, name, brand, model, plate_number, year, current_odometer, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.userId, name, brand || '', model || '', plate_number || '', parseInt(year) || null, parseInt(current_odometer) || 0, !!is_active]
    );
    return res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    console.error("Create vehicle error:", err);
    return res.status(500).json({ error: "Gagal menyimpan data kendaraan baru." });
  }
});

// PUT /api/vehicles/:id
app.put('/api/vehicles/:id', requireAuth, async (req, res) => {
  const { name, brand, model, plate_number, year, current_odometer, is_active } = req.body;
  const vehicleId = parseInt(req.params.id);

  try {
    if (is_active) {
      await pool.query('UPDATE vehicles SET is_active = false WHERE user_id = $1', [req.userId]);
    }
    const updateRes = await pool.query(
      `UPDATE vehicles 
       SET name = $1, brand = $2, model = $3, plate_number = $4, year = $5, current_odometer = $6, is_active = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 AND user_id = $9 RETURNING *`,
      [name, brand || '', model || '', plate_number || '', parseInt(year) || null, parseInt(current_odometer) || 0, !!is_active, vehicleId, req.userId]
    );
    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: "Kendaraan tidak ditemukan atau bukan milik Anda." });
    }
    return res.status(200).json(updateRes.rows[0]);
  } catch (err) {
    console.error("Update vehicle error:", err);
    return res.status(500).json({ error: "Gagal memperbarui data kendaraan." });
  }
});

// DELETE /api/vehicles/:id
app.delete('/api/vehicles/:id', requireAuth, async (req, res) => {
  const vehicleId = parseInt(req.params.id);
  try {
    const delRes = await pool.query('DELETE FROM vehicles WHERE id = $1 AND user_id = $2 RETURNING *', [vehicleId, req.userId]);
    if (delRes.rows.length === 0) {
      return res.status(404).json({ error: "Kendaraan tidak ditemukan." });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Delete vehicle error:", err);
    return res.status(500).json({ error: "Gagal menghapus kendaraan." });
  }
});

// ----------------------------------------------------
// COMPONENTS ENDPOINTS
// ----------------------------------------------------

// GET /api/components
app.get('/api/components', requireAuth, async (req, res) => {
  const { vehicle_id } = req.query;
  if (!vehicle_id) return res.status(400).json({ error: "vehicle_id query parameter wajib disertakan." });
  try {
    const comps = await pool.query(
      'SELECT * FROM components WHERE vehicle_id = $1 AND user_id = $2 ORDER BY created_at ASC',
      [parseInt(vehicle_id), req.userId]
    );
    return res.status(200).json(comps.rows);
  } catch (err) {
    console.error("Get components error:", err);
    return res.status(500).json({ error: "Gagal mengambil data komponen." });
  }
});

// POST /api/components
app.post('/api/components', requireAuth, async (req, res) => {
  const { vehicle_id, name, icon, interval_km, interval_days, last_service_odometer, last_service_date, is_custom } = req.body;
  if (!vehicle_id || !name || !interval_km) {
    return res.status(400).json({ error: "vehicle_id, nama, dan interval kilometer wajib diisi." });
  }
  try {
    const insertRes = await pool.query(
      `INSERT INTO components (user_id, vehicle_id, name, icon, interval_km, interval_days, last_service_odometer, last_service_date, is_custom)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.userId, parseInt(vehicle_id), name, icon || 'Wrench', parseInt(interval_km), parseInt(interval_days) || null, parseInt(last_service_odometer) || 0, last_service_date || null, !!is_custom]
    );
    return res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    console.error("Create component error:", err);
    return res.status(500).json({ error: "Gagal menyimpan komponen baru." });
  }
});

// PUT /api/components/:id
app.put('/api/components/:id', requireAuth, async (req, res) => {
  const { name, icon, interval_km, interval_days, last_service_odometer, last_service_date } = req.body;
  const compId = parseInt(req.params.id);

  try {
    const updateRes = await pool.query(
      `UPDATE components 
       SET name = $1, icon = $2, interval_km = $3, interval_days = $4, last_service_odometer = $5, last_service_date = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND user_id = $8 RETURNING *`,
      [name, icon || 'Wrench', parseInt(interval_km), parseInt(interval_days) || null, parseInt(last_service_odometer) || 0, last_service_date || null, compId, req.userId]
    );
    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: "Komponen tidak ditemukan." });
    }
    return res.status(200).json(updateRes.rows[0]);
  } catch (err) {
    console.error("Update component error:", err);
    return res.status(500).json({ error: "Gagal memperbarui data komponen." });
  }
});

// DELETE /api/components/:id
app.delete('/api/components/:id', requireAuth, async (req, res) => {
  const compId = parseInt(req.params.id);
  try {
    const delRes = await pool.query('DELETE FROM components WHERE id = $1 AND user_id = $2 RETURNING *', [compId, req.userId]);
    if (delRes.rows.length === 0) {
      return res.status(404).json({ error: "Komponen tidak ditemukan." });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Delete component error:", err);
    return res.status(500).json({ error: "Gagal menghapus komponen." });
  }
});

// ----------------------------------------------------
// SERVICE HISTORY ENDPOINTS (With Caching and Pagination)
// ----------------------------------------------------

// GET /api/service-history
app.get('/api/service-history', requireAuth, async (req, res) => {
  const { vehicle_id, page = 1, limit = 10 } = req.query;
  if (!vehicle_id) return res.status(400).json({ error: "vehicle_id query parameter wajib disertakan." });

  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    // Total count for pagination
    const countRes = await pool.query(
      'SELECT COUNT(*) FROM service_history WHERE vehicle_id = $1 AND user_id = $2',
      [parseInt(vehicle_id), req.userId]
    );
    const totalItems = parseInt(countRes.rows[0].count);

    // Get logs for the current page
    const historyRes = await pool.query(
      `SELECT * FROM service_history 
       WHERE vehicle_id = $1 AND user_id = $2 
       ORDER BY service_date DESC, id DESC 
       LIMIT $3 OFFSET $4`,
      [parseInt(vehicle_id), req.userId, parseInt(limit), offset]
    );

    const logs = historyRes.rows;

    // Fetch details for components for each log
    const enrichedLogs = [];
    for (const log of logs) {
      const itemsRes = await pool.query(
        'SELECT component_name FROM service_history_components WHERE service_history_id = $1',
        [log.id]
      );
      enrichedLogs.push({
        id: log.id,
        vehicleId: log.vehicle_id,
        date: log.service_date,
        odo: log.odometer,
        components: itemsRes.rows.map(r => r.component_name),
        notes: log.notes,
        cost: parseFloat(log.cost) || 0
      });
    }

    // Set Cache-Control header for client side performance optimization
    res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    return res.status(200).json({
      data: enrichedLogs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalItems / parseInt(limit)),
        totalItems
      }
    });
  } catch (err) {
    console.error("Get service history error:", err);
    return res.status(500).json({ error: "Gagal mengambil riwayat servis." });
  }
});

// POST /api/service-history
app.post('/api/service-history', requireAuth, async (req, res) => {
  const { vehicle_id, date, odo, cost, notes, components } = req.body;
  if (!vehicle_id || !date || !odo) {
    return res.status(400).json({ error: "vehicle_id, tanggal, dan odometer wajib diisi." });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create Service Log
    const insertLogRes = await client.query(
      `INSERT INTO service_history (user_id, vehicle_id, service_date, odometer, cost, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.userId, parseInt(vehicle_id), date, parseInt(odo), parseFloat(cost) || 0, notes || '']
    );
    const savedLog = insertLogRes.rows[0];

    // Insert serviced components
    if (components && components.length > 0) {
      for (const compName of components) {
        await client.query(
          'INSERT INTO service_history_components (service_history_id, component_name) VALUES ($1, $2)',
          [savedLog.id, compName]
        );
      }
    }

    await client.query('COMMIT');

    return res.status(201).json({
      id: savedLog.id,
      vehicleId: savedLog.vehicle_id,
      date: savedLog.service_date,
      odo: savedLog.odometer,
      components: components || [],
      notes: savedLog.notes,
      cost: parseFloat(savedLog.cost) || 0
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Create service log error:", err);
    return res.status(500).json({ error: "Gagal menyimpan riwayat servis baru." });
  } finally {
    client.release();
  }
});

// PUT /api/service-history/:id
app.put('/api/service-history/:id', requireAuth, async (req, res) => {
  const { date, odo, cost, notes, components } = req.body;
  const logId = parseInt(req.params.id);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updateLogRes = await client.query(
      `UPDATE service_history 
       SET service_date = $1, odometer = $2, cost = $3, notes = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND user_id = $6 RETURNING *`,
      [date, parseInt(odo), parseFloat(cost) || 0, notes || '', logId, req.userId]
    );

    if (updateLogRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Riwayat servis tidak ditemukan." });
    }
    const savedLog = updateLogRes.rows[0];

    // Delete old items and insert updated ones
    await client.query('DELETE FROM service_history_components WHERE service_history_id = $1', [logId]);
    if (components && components.length > 0) {
      for (const compName of components) {
        await client.query(
          'INSERT INTO service_history_components (service_history_id, component_name) VALUES ($1, $2)',
          [logId, compName]
        );
      }
    }

    await client.query('COMMIT');
    return res.status(200).json({
      id: savedLog.id,
      vehicleId: savedLog.vehicle_id,
      date: savedLog.service_date,
      odo: savedLog.odometer,
      components: components || [],
      notes: savedLog.notes,
      cost: parseFloat(savedLog.cost) || 0
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Update service log error:", err);
    return res.status(500).json({ error: "Gagal memperbarui riwayat servis." });
  } finally {
    client.release();
  }
});

// DELETE /api/service-history/:id
app.delete('/api/service-history/:id', requireAuth, async (req, res) => {
  const logId = parseInt(req.params.id);
  try {
    const delRes = await pool.query('DELETE FROM service_history WHERE id = $1 AND user_id = $2 RETURNING *', [logId, req.userId]);
    if (delRes.rows.length === 0) {
      return res.status(404).json({ error: "Riwayat servis tidak ditemukan." });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Delete service log error:", err);
    return res.status(500).json({ error: "Gagal menghapus riwayat servis." });
  }
});

// ----------------------------------------------------
// WORKSHOPS (BENGKEL) ENDPOINTS
// ----------------------------------------------------

// GET /api/workshops
app.get('/api/workshops', requireAuth, async (req, res) => {
  const { page = 1, limit = 10, search = '' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  try {
    let queryText = 'SELECT * FROM workshops WHERE user_id = $1';
    let queryParams = [req.userId];
    
    if (search.trim() !== '') {
      queryText += ' AND (name ILIKE $2 OR address ILIKE $2 OR notes ILIKE $2)';
      queryParams.push(`%${search.trim()}%`);
    }
    
    // Get total items for pagination
    const countRes = await pool.query(`SELECT COUNT(*) FROM (${queryText}) AS temp`, queryParams);
    const totalItems = parseInt(countRes.rows[0].count);
    
    // Add pagination clauses
    queryText += ` ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(parseInt(limit), offset);
    
    const shopsRes = await pool.query(queryText, queryParams);
    
    return res.status(200).json({
      data: shopsRes.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalItems / parseInt(limit)),
        totalItems
      }
    });
  } catch (err) {
    console.error("Get workshops error:", err);
    return res.status(500).json({ error: "Gagal mengambil data bengkel." });
  }
});

// POST /api/workshops
app.post('/api/workshops', requireAuth, async (req, res) => {
  const { name, address, phone, category, notes } = req.body;
  if (!name) return res.status(400).json({ error: "Nama bengkel wajib diisi." });
  try {
    const insertRes = await pool.query(
      `INSERT INTO workshops (user_id, name, address, phone, category, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.userId, name, address || '', phone || '', category || 'Lainnya', notes || '']
    );
    return res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    console.error("Create workshop error:", err);
    return res.status(500).json({ error: "Gagal menyimpan data bengkel baru." });
  }
});

// PUT /api/workshops/:id
app.put('/api/workshops/:id', requireAuth, async (req, res) => {
  const { name, address, phone, category, notes } = req.body;
  const shopId = parseInt(req.params.id);
  try {
    const updateRes = await pool.query(
      `UPDATE workshops 
       SET name = $1, address = $2, phone = $3, category = $4, notes = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND user_id = $7 RETURNING *`,
      [name, address || '', phone || '', category || 'Lainnya', notes || '', shopId, req.userId]
    );
    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: "Bengkel tidak ditemukan." });
    }
    return res.status(200).json(updateRes.rows[0]);
  } catch (err) {
    console.error("Update workshop error:", err);
    return res.status(500).json({ error: "Gagal memperbarui data bengkel." });
  }
});

// DELETE /api/workshops/:id
app.delete('/api/workshops/:id', requireAuth, async (req, res) => {
  const shopId = parseInt(req.params.id);
  try {
    const delRes = await pool.query('DELETE FROM workshops WHERE id = $1 AND user_id = $2 RETURNING *', [shopId, req.userId]);
    if (delRes.rows.length === 0) {
      return res.status(404).json({ error: "Bengkel tidak ditemukan." });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Delete workshop error:", err);
    return res.status(500).json({ error: "Gagal menghapus data bengkel." });
  }
});

// ----------------------------------------------------
// SETTINGS ENDPOINTS
// ----------------------------------------------------

// GET /api/settings
app.get('/api/settings', requireAuth, async (req, res) => {
  try {
    const settingsRes = await pool.query('SELECT * FROM settings WHERE user_id = $1', [req.userId]);
    if (settingsRes.rows.length === 0) {
      const newSettings = await pool.query('INSERT INTO settings (user_id) VALUES ($1) RETURNING *', [req.userId]);
      return res.status(200).json(newSettings.rows[0]);
    }
    return res.status(200).json(settingsRes.rows[0]);
  } catch (err) {
    console.error("Get settings error:", err);
    return res.status(500).json({ error: "Gagal mengambil data pengaturan." });
  }
});

// PUT /api/settings
app.put('/api/settings', requireAuth, async (req, res) => {
  const { theme, notification_enabled, tracking_enabled } = req.body;
  try {
    const updateRes = await pool.query(
      `INSERT INTO settings (user_id, theme, notification_enabled, tracking_enabled, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) 
       DO UPDATE SET theme = $2, notification_enabled = $3, tracking_enabled = $4, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.userId, theme || 'dark', notification_enabled !== false, tracking_enabled === true]
    );
    return res.status(200).json(updateRes.rows[0]);
  } catch (err) {
    console.error("Update settings error:", err);
    return res.status(500).json({ error: "Gagal menyimpan data pengaturan." });
  }
});

// ----------------------------------------------------
// OPTIMIZED SUMMARY API
// ----------------------------------------------------

// GET /api/dashboard-summary
// Aggregates everything needed for the main landing page in one call (reduces roundtrips)
app.get('/api/dashboard-summary', requireAuth, async (req, res) => {
  try {
    // 1. Get vehicles
    const vehiclesRes = await pool.query('SELECT * FROM vehicles WHERE user_id = $1 ORDER BY created_at ASC', [req.userId]);
    const vehicles = vehiclesRes.rows;
    
    // Find active vehicle
    let activeVehicle = vehicles.find(v => v.is_active);
    if (!activeVehicle && vehicles.length > 0) {
      activeVehicle = vehicles[0];
    }
    
    let components = [];
    let serviceLogs = [];
    
    if (activeVehicle) {
      // 2. Get components of active vehicle
      const compsRes = await pool.query('SELECT * FROM components WHERE vehicle_id = $1 AND user_id = $2', [activeVehicle.id, req.userId]);
      components = compsRes.rows;
      
      // 3. Get recent service history
      const historyRes = await pool.query(
        'SELECT * FROM service_history WHERE vehicle_id = $1 AND user_id = $2 ORDER BY service_date DESC, id DESC LIMIT 5',
        [activeVehicle.id, req.userId]
      );
      
      for (const log of historyRes.rows) {
        const itemsRes = await pool.query(
          'SELECT component_name FROM service_history_components WHERE service_history_id = $1',
          [log.id]
        );
        serviceLogs.push({
          id: log.id,
          vehicleId: log.vehicle_id,
          date: log.service_date,
          odo: log.odometer,
          components: itemsRes.rows.map(r => r.component_name),
          notes: log.notes,
          cost: parseFloat(log.cost) || 0
        });
      }
    }
    
    // 4. Settings
    const settingsRes = await pool.query('SELECT * FROM settings WHERE user_id = $1', [req.userId]);
    let settings = settingsRes.rows.length > 0 ? settingsRes.rows[0] : null;
    
    return res.status(200).json({
      vehicles,
      activeVehicleId: activeVehicle ? activeVehicle.id : null,
      components,
      serviceLogs,
      settings
    });
  } catch (err) {
    console.error("Dashboard summary aggregation error:", err);
    return res.status(500).json({ error: "Gagal memuat ringkasan dashboard." });
  }
});

// GET /api/service-costs-summary
// Fetches costs grouped by month for chart to render cost graphs efficiently
app.get('/api/service-costs-summary', requireAuth, async (req, res) => {
  const { vehicle_id } = req.query;
  if (!vehicle_id) return res.status(400).json({ error: "vehicle_id query parameter wajib disertakan." });
  
  try {
    const costsRes = await pool.query(
      `SELECT 
         TO_CHAR(service_date, 'YYYY-MM') as month_key,
         SUM(cost) as total_cost
       FROM service_history
       WHERE vehicle_id = $1 AND user_id = $2
       GROUP BY month_key
       ORDER BY month_key DESC
       LIMIT 12`,
      [parseInt(vehicle_id), req.userId]
    );
    
    return res.status(200).json(costsRes.rows);
  } catch (err) {
    console.error("Costs summary error:", err);
    return res.status(500).json({ error: "Gagal mengambil data ringkasan biaya." });
  }
});

// For Vercel Serverless environment export
module.exports = app;
