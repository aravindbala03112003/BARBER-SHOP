/**
 * Barber Shop - Backend Server
 * Express.js with MySQL Integration, Email Notifications, and Static Assets
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const { initDatabase, query, isDbConnected } = require('./database/db');
const { verifyEmailConfig, dispatchAppointmentEmails } = require('./services/emailService');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware (Helmet with relaxed CSP for CDN scripts & fonts)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://unpkg.com"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com"
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "data:"
        ],
        imgSrc: [
          "'self'",
          "data:",
          "https:"
        ],
        connectSrc: ["'self'"]
      }
    },
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

// CORS configuration (allow deployed frontends and localhost)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['*'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS'));
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Body Parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Rate Limiters for Public Submission Endpoints
const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 submissions per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many booking attempts from this network. Please try again after 15 minutes.'
  }
});

const newsletterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many subscription attempts from this network. Please try again later.'
  }
});

// Standard Business Hours Time Slots
const STANDARD_TIME_SLOTS = [
  '08:00 AM',
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '01:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
  '05:00 PM',
  '06:00 PM',
  '07:00 PM',
  '08:00 PM'
];

// Helper: Validation utilities
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && emailRegex.test(email.trim());
}

function isValidPhone(phone) {
  const phoneRegex = /^[\d\s()+-]{7,25}$/;
  return typeof phone === 'string' && phoneRegex.test(phone.trim());
}

function isValidDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const targetDate = new Date(dateStr + 'T00:00:00');
  if (isNaN(targetDate.getTime())) return false;

  // Disallow past dates (allow today and future)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return targetDate >= today;
}

// ==========================================
// API ENDPOINTS
// ==========================================

/**
 * Health Check API
 * GET /api/health
 */
app.get('/api/health', async (req, res) => {
  const emailHealth = await verifyEmailConfig();
  if (!isDbConnected()) {
    await initDatabase();
  }
  let dbAlive = isDbConnected();
  if (dbAlive) {
    try {
      await query('SELECT 1');
    } catch (e) {
      console.warn('[DB Ping Warning]', e.message);
      dbAlive = false;
    }
  }

  res.status(200).json({
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      connected: dbAlive,
      mode: dbAlive ? 'mysql_persistent' : 'local_mock_persistence'
    },
    emailService: {
      configured: emailHealth.ready,
      status: emailHealth.message
    }
  });
});

/**
 * Available Time Slots API
 * GET /api/appointments/availability?date=YYYY-MM-DD
 */
app.get('/api/appointments/availability', async (req, res, next) => {
  try {
    const { date } = req.query;

    if (!date || !isValidDate(date)) {
      return res.status(400).json({
        success: false,
        message: 'A valid appointment date (today or future in YYYY-MM-DD format) is required.'
      });
    }

    // Check day of week (Salon open Sun-Fri, Closed on Saturday)
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    if (dayOfWeek === 6) {
      return res.status(200).json({
        success: true,
        date,
        isClosed: true,
        message: 'The salon is closed on Saturdays. Our opening hours are Sunday to Friday, 08:00 AM - 09:00 PM.',
        availableSlots: []
      });
    }

    // Query confirmed appointments for this date
    const bookedRows = await query(
      'SELECT appointment_time FROM appointments WHERE appointment_date = ? AND status = ?',
      [date, 'confirmed']
    );

    const bookedTimes = new Set((bookedRows || []).map(r => r.appointment_time));
    const availableSlots = STANDARD_TIME_SLOTS.filter(slot => !bookedTimes.has(slot));

    return res.status(200).json({
      success: true,
      date,
      businessHours: 'Sunday - Friday, 08:00 AM - 09:00 PM',
      totalSlots: STANDARD_TIME_SLOTS.length,
      bookedCount: bookedTimes.size,
      availableSlots
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Create Appointment API
 * POST /api/appointments
 */
app.post('/api/appointments', bookingLimiter, async (req, res, next) => {
  try {
    const {
      name,
      email,
      phone,
      service,
      barber,
      date,
      time,
      notes
    } = req.body;

    // Strict input validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid full name (at least 2 characters).'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number (digits and formatting only).'
      });
    }

    if (!service || typeof service !== 'string' || service.trim() === 'Select category') {
      return res.status(400).json({
        success: false,
        message: 'Please select a valid salon service.'
      });
    }

    if (!isValidDate(date)) {
      return res.status(400).json({
        success: false,
        message: 'Please choose an appointment date for today or in the future.'
      });
    }

    // Verify day is not Saturday
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    if (dayOfWeek === 6) {
      return res.status(400).json({
        success: false,
        message: 'The salon is closed on Saturdays. Please select Sunday through Friday.'
      });
    }

    if (!time || !STANDARD_TIME_SLOTS.includes(time.trim())) {
      return res.status(400).json({
        success: false,
        message: `Please select an available time slot within business hours (${STANDARD_TIME_SLOTS[0]} to ${STANDARD_TIME_SLOTS[STANDARD_TIME_SLOTS.length - 1]}).`
      });
    }

    const sanitizedName = name.trim().substring(0, 100);
    const sanitizedEmail = email.trim().toLowerCase().substring(0, 150);
    const sanitizedPhone = phone.trim().substring(0, 30);
    const sanitizedService = service.trim().substring(0, 100);
    const sanitizedBarber = (barber && typeof barber === 'string' && barber.trim()) ? barber.trim().substring(0, 100) : 'Master Barber';
    const sanitizedTime = time.trim();
    const sanitizedNotes = notes ? String(notes).trim().substring(0, 500) : null;

    // Generate unique human-readable booking reference
    const uniqueSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const timestampPart = Date.now().toString(36).toUpperCase().slice(-4);
    const bookingReference = `BARB-${timestampPart}-${uniqueSuffix}`;

    // Attempt insert into MySQL
    try {
      await query(
        `INSERT INTO appointments 
         (booking_reference, customer_name, customer_email, customer_phone, service_name, barber_name, appointment_date, appointment_time, notes, status, notification_sent) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          bookingReference,
          sanitizedName,
          sanitizedEmail,
          sanitizedPhone,
          sanitizedService,
          sanitizedBarber,
          date,
          sanitizedTime,
          sanitizedNotes,
          'confirmed',
          0
        ]
      );
    } catch (dbErr) {
      if (dbErr.code === 'ER_DUP_ENTRY' || dbErr.message.includes('Duplicate entry')) {
        return res.status(409).json({
          success: false,
          conflict: true,
          message: 'The requested appointment slot has already been booked. Please pick another available time.'
        });
      }
      throw dbErr;
    }

    const appointmentRecord = {
      booking_reference: bookingReference,
      customer_name: sanitizedName,
      customer_email: sanitizedEmail,
      customer_phone: sanitizedPhone,
      service_name: sanitizedService,
      barber_name: sanitizedBarber,
      appointment_date: date,
      appointment_time: sanitizedTime,
      notes: sanitizedNotes,
      status: 'confirmed'
    };

    // Dispatch email notifications
    let emailStatus = { delivered: false, simulated: true, message: 'SMTP not configured' };
    try {
      const emailResult = await dispatchAppointmentEmails(appointmentRecord);
      emailStatus = {
        delivered: !!emailResult.customerDelivered,
        adminDelivered: !!emailResult.adminDelivered,
        simulated: !!emailResult.simulated,
        error: emailResult.customerError || emailResult.adminError || null
      };

      if (emailResult.anyDelivered) {
        try {
          await query(
            'UPDATE appointments SET notification_sent = 1 WHERE booking_reference = ?',
            [bookingReference]
          );
        } catch (e) {
          console.warn('[DB] Failed to update notification_sent flag:', e.message);
        }
      }
    } catch (emailErr) {
      console.error('[Email Dispatch Error]', emailErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Your appointment has been successfully booked!',
      appointment: appointmentRecord,
      emailStatus
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Newsletter Subscription API
 * POST /api/newsletter/subscribe
 */
app.post('/api/newsletter/subscribe', newsletterLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    const sanitizedEmail = email.trim().toLowerCase().substring(0, 150);

    try {
      await query(
        'INSERT INTO newsletter_subscribers (email, status) VALUES (?, ?)',
        [sanitizedEmail, 'subscribed']
      );

      return res.status(201).json({
        success: true,
        message: 'Thank you for subscribing! You will receive our latest styling updates and exclusive offers.'
      });
    } catch (dbErr) {
      if (dbErr.code === 'ER_DUP_ENTRY' || dbErr.message.includes('Duplicate entry')) {
        return res.status(200).json({
          success: true,
          duplicate: true,
          message: 'You are already subscribed to our newsletter! Thank you for staying connected.'
        });
      }
      throw dbErr;
    }
  } catch (err) {
    next(err);
  }
});

// ==========================================
// STATIC FRONTEND ASSETS & FALLBACK
// ==========================================
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use(express.static(__dirname));

app.get('*', (req, res, next) => {
  // If request is for an API route, pass to error handler
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'API route not found' });
  }
  // Otherwise serve index.html for smooth single-page behavior
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.stack || err.message);
  res.status(500).json({
    success: false,
    message: 'An unexpected internal error occurred. Please try again shortly.'
  });
});

// Initialize Database & Start Listening
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`=================================================`);
      console.log(`  Barber Shop Server running on port ${PORT}`);
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`  Live URL: http://localhost:${PORT}`);
      console.log(`=================================================`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

module.exports = app;
