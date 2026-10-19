/**
 * Database Module (MySQL Integration)
 * Uses mysql2/promise connection pool with automatic initialization.
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let pool = null;
let isConnected = false;
let fallbackMemoryStore = {
  appointments: [],
  newsletter_subscribers: []
};

// Parse configuration from DATABASE_URL or individual variables
function getDbConfig() {
  const connectionUri = process.env.DATABASE_URL || process.env.MYSQL_URL;

  if (connectionUri) {
    try {
      const url = new URL(connectionUri);
      return {
        host: url.hostname,
        port: url.port ? parseInt(url.port, 10) : 3306,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.replace(/^\//, ''),
        ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: false },
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000
      };
    } catch (e) {
      console.warn('[DB] Failed to parse DATABASE_URL, falling back to individual env variables');
    }
  }

  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;
  const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306;
  const ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined;

  if (!host || !user || !database) {
    return null;
  }

  return {
    host,
    port,
    user,
    password: password || '',
    database,
    ssl,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
  };
}

async function initDatabase() {
  const config = getDbConfig();

  if (!config) {
    console.warn('[DB] MySQL credentials not fully configured in environment variables. Operating in Local Mock Persistence mode.');
    isConnected = false;
    return false;
  }

  try {
    pool = mysql.createPool(config);
    const connection = await pool.getConnection();
    console.log(`[DB] Successfully connected to MySQL at ${config.host}:${config.port}/${config.database}`);

    // Create tables if not exist
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    const statements = schemaSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const stmt of statements) {
      try {
        await connection.query(stmt);
      } catch (err) {
        // Ignore duplicate insertion or existing table notices
        if (!err.message.includes('already exists') && !err.message.includes('Duplicate entry')) {
          console.warn(`[DB] Schema setup notice: ${err.message}`);
        }
      }
    }

    connection.release();
    isConnected = true;
    console.log('[DB] Database schema verified and ready.');
    return true;
  } catch (error) {
    console.error(`[DB] MySQL connection error: ${error.message}`);
    isConnected = false;
    return false;
  }
}

async function getPool() {
  if (!pool && !isConnected) {
    await initDatabase();
  }
  return pool;
}

// Database query wrapper with error handling and fallback
async function query(sql, params = []) {
  if (pool && isConnected) {
    try {
      const [rows, fields] = await pool.execute(sql, params);
      return rows;
    } catch (err) {
      console.error(`[DB Query Error] ${err.message} | SQL: ${sql}`);
      throw err;
    }
  }

  // Fallback memory implementation for offline development testing
  return handleMockQuery(sql, params);
}

function handleMockQuery(sql, params) {
  const normalized = sql.trim().toLowerCase();

  // Appointments availability check
  if (normalized.startsWith('select appointment_time from appointments')) {
    const [date, status] = params;
    const bookedTimes = fallbackMemoryStore.appointments
      .filter(a => a.appointment_date === date && (a.status === status || a.status === 'confirmed'))
      .map(a => ({ appointment_time: a.appointment_time }));
    return bookedTimes;
  }

  // Appointment insert
  if (normalized.startsWith('insert into appointments')) {
    const [ref, name, email, phone, service, barber, date, time, notes, status, notif] = params;
    // Check unique slot conflict
    const conflict = fallbackMemoryStore.appointments.find(
      a => a.appointment_date === date && a.appointment_time === time && a.status === 'confirmed'
    );
    if (conflict) {
      const err = new Error("Duplicate entry for slot");
      err.code = 'ER_DUP_ENTRY';
      throw err;
    }

    const newId = fallbackMemoryStore.appointments.length + 1;
    const newAppointment = {
      id: newId,
      booking_reference: ref,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      service_name: service,
      barber_name: barber,
      appointment_date: date,
      appointment_time: time,
      notes: notes,
      status: status || 'confirmed',
      notification_sent: notif || 0,
      created_at: new Date()
    };
    fallbackMemoryStore.appointments.push(newAppointment);
    return { insertId: newId, affectedRows: 1 };
  }

  // Update notification_sent
  if (normalized.startsWith('update appointments set notification_sent')) {
    const [sent, ref] = params;
    const appt = fallbackMemoryStore.appointments.find(a => a.booking_reference === ref);
    if (appt) appt.notification_sent = sent;
    return { affectedRows: appt ? 1 : 0 };
  }

  // Newsletter subscribe
  if (normalized.startsWith('insert into newsletter_subscribers')) {
    const [email, status] = params;
    const existing = fallbackMemoryStore.newsletter_subscribers.find(s => s.email === email);
    if (existing) {
      const err = new Error("Duplicate entry for newsletter email");
      err.code = 'ER_DUP_ENTRY';
      throw err;
    }
    const newId = fallbackMemoryStore.newsletter_subscribers.length + 1;
    fallbackMemoryStore.newsletter_subscribers.push({
      id: newId,
      email,
      status: status || 'subscribed',
      created_at: new Date()
    });
    return { insertId: newId, affectedRows: 1 };
  }

  // Select all appointments / count
  if (normalized.startsWith('select count(*)')) {
    return [{ count: fallbackMemoryStore.appointments.length }];
  }

  return [];
}

module.exports = {
  initDatabase,
  query,
  getPool,
  isDbConnected: () => isConnected,
  getMockStore: () => fallbackMemoryStore
};
