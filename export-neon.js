const { Pool } = require('pg');
const fs = require('fs');

const connectionString = 'postgresql://neondb_owner:npg_JRHpebZXUP84@ep-fragrant-base-aop6e9ch-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

const schemaSql = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
);

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
);

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
);

CREATE TABLE IF NOT EXISTS service_history_components (
  id SERIAL PRIMARY KEY,
  service_history_id INTEGER REFERENCES service_history(id) ON DELETE CASCADE,
  component_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
);

CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  theme VARCHAR(255) DEFAULT 'dark',
  notification_enabled BOOLEAN DEFAULT true,
  tracking_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

async function exportAll() {
  const client = await pool.connect();
  try {
    await client.query('SET search_path TO public, pg_catalog;');

    const tables = [
      'users',
      'vehicles',
      'components',
      'service_history',
      'service_history_components',
      'workshops',
      'settings'
    ];

    let fullSql = `-- MOTOCARE COMPLETE BACKUP FROM NEON\n`;
    fullSql += `-- Dumped at: ${new Date().toISOString()}\n\n`;
    fullSql += `SET client_encoding = 'UTF8';\n`;
    fullSql += `SET search_path = public, pg_catalog;\n\n`;
    fullSql += schemaSql + '\n\n';

    for (const table of tables) {
      const { rows } = await client.query(`SELECT * FROM public."${table}"`);
      if (rows.length === 0) continue;

      const cols = Object.keys(rows[0]);
      for (const row of rows) {
        const valList = cols.map(c => {
          const v = row[c];
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'number') return v;
          if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
          if (v instanceof Date) return `'${v.toISOString()}'`;
          if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
          return `'${String(v).replace(/'/g, "''")}'`;
        }).join(', ');

        fullSql += `INSERT INTO public."${table}" ("${cols.join('", "')}") VALUES (${valList}) ON CONFLICT DO NOTHING;\n`;
      }
      fullSql += '\n';

      // Update sequence
      fullSql += `SELECT setval(pg_get_serial_sequence('public."${table}"', 'id'), coalesce(max(id), 1)) FROM public."${table}";\n\n`;
    }

    fs.writeFileSync('motocare_backup.sql', fullSql, 'utf8');
    console.log('✅ BERHASIL! File motocare_backup.sql sudah dibuat lengkap beserta schemanya!');
  } finally {
    client.release();
    pool.end();
  }
}

exportAll().catch(console.error);
