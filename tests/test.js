/**
 * Automated Test Suite for Barber Shop Web Application
 * Tests API Endpoints, Validation Rules, Conflict Detection, and Newsletter
 */

const http = require('http');

let serverProcess = null;
let PORT = 3001; // Test port to avoid colliding with default port

// Helper: Make HTTP request to test server
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: '127.0.0.1',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (payload) {
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

// Compute upcoming dates for tests (ensure future Sunday-Friday date)
function getFutureValidDate(daysAhead = 1) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  // If Saturday (6), advance to Sunday (0)
  if (d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getFutureSaturday() {
  const d = new Date();
  while (d.getDay() !== 6) {
    d.setDate(d.getDate() + 1);
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function runTests() {
  console.log('====================================================');
  console.log('   BARBER SHOP APPLICATION - AUTOMATED TEST SUITE   ');
  console.log('====================================================\n');

  // Launch application in test mode
  process.env.PORT = String(PORT);
  process.env.NODE_ENV = 'test';

  const app = require('../server');

  // Allow server initialization to complete
  await new Promise((r) => setTimeout(r, 1200));

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  \x1b[32mPASS\x1b[0m ${name}`);
      passed++;
    } catch (err) {
      console.error(`  \x1b[31mFAIL\x1b[0m ${name}`);
      console.error(`       Error: ${err.message}`);
      failed++;
    }
  }

  // --- HEALTH CHECK TESTS ---
  await test('GET /api/health returns HTTP 200 and server status', async () => {
    const res = await request('GET', '/api/health');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (res.data.status !== 'ok') throw new Error(`Expected status ok, got ${res.data.status}`);
    if (!res.data.database) throw new Error('Missing database status in health response');
  });

  // --- STATIC FILE SERVING TESTS ---
  await test('GET / serves index.html with appointment & contact anchors', async () => {
    const res = await request('GET', '/');
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (typeof res.data !== 'string') throw new Error('Expected HTML string response');
    if (!res.data.includes('id="appointment"')) throw new Error('Missing id="appointment" in HTML');
    if (!res.data.includes('id="contact"')) throw new Error('Missing id="contact" in HTML');
    if (!res.data.includes('data-service-select="Hair Cutting Style"')) throw new Error('Missing data-service-select in service cards');
  });

  // --- AVAILABILITY TESTS ---
  const validDate = getFutureValidDate(2);
  const saturdayDate = getFutureSaturday();

  await test(`GET /api/appointments/availability for future weekday (${validDate}) returns available slots`, async () => {
    const res = await request('GET', `/api/appointments/availability?date=${validDate}`);
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (!res.data.success) throw new Error('Expected success true');
    if (!Array.isArray(res.data.availableSlots) || res.data.availableSlots.length === 0) {
      throw new Error('Expected availableSlots to be non-empty array');
    }
  });

  await test('GET /api/appointments/availability rejects past dates with HTTP 400', async () => {
    const res = await request('GET', '/api/appointments/availability?date=2020-01-01');
    if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
    if (res.data.success !== false) throw new Error('Expected success false for past date');
  });

  await test(`GET /api/appointments/availability detects Saturday (${saturdayDate}) as closed`, async () => {
    const res = await request('GET', `/api/appointments/availability?date=${saturdayDate}`);
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (!res.data.isClosed) throw new Error('Expected isClosed to be true for Saturday');
    if (res.data.availableSlots.length !== 0) throw new Error('Expected 0 slots on Saturday');
  });

  // --- APPOINTMENT VALIDATION TESTS ---
  await test('POST /api/appointments rejects missing name with HTTP 400', async () => {
    const res = await request('POST', '/api/appointments', {
      name: '',
      email: 'alex@example.com',
      phone: '0123456789',
      service: 'Hair Cutting Style',
      date: validDate,
      time: '10:00 AM'
    });
    if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
  });

  await test('POST /api/appointments rejects invalid email with HTTP 400', async () => {
    const res = await request('POST', '/api/appointments', {
      name: 'Alex Johnson',
      email: 'not-an-email',
      phone: '0123456789',
      service: 'Hair Cutting Style',
      date: validDate,
      time: '10:00 AM'
    });
    if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
  });

  await test('POST /api/appointments rejects invalid phone with HTTP 400', async () => {
    const res = await request('POST', '/api/appointments', {
      name: 'Alex Johnson',
      email: 'alex@example.com',
      phone: 'abc',
      service: 'Hair Cutting Style',
      date: validDate,
      time: '10:00 AM'
    });
    if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
  });

  await test('POST /api/appointments rejects invalid service category with HTTP 400', async () => {
    const res = await request('POST', '/api/appointments', {
      name: 'Alex Johnson',
      email: 'alex@example.com',
      phone: '0123456789',
      service: 'Select category',
      date: validDate,
      time: '10:00 AM'
    });
    if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
  });

  await test('POST /api/appointments rejects Saturday booking with HTTP 400', async () => {
    const res = await request('POST', '/api/appointments', {
      name: 'Alex Johnson',
      email: 'alex@example.com',
      phone: '0123456789',
      service: 'Hair Cutting Style',
      date: saturdayDate,
      time: '10:00 AM'
    });
    if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
  });

  // --- SUCCESSFUL BOOKING TEST ---
  let bookedRef = null;
  await test('POST /api/appointments successfully creates appointment and returns 201', async () => {
    const res = await request('POST', '/api/appointments', {
      name: 'Michael Barber',
      email: 'michael.barber.test@example.com',
      phone: '012 (345) 67 895',
      service: 'Hair Cutting Style',
      barber: 'Master Barber',
      date: validDate,
      time: '11:00 AM',
      notes: 'Test automated appointment'
    });
    if (res.statusCode !== 201) throw new Error(`Expected 201, got ${res.statusCode} (${JSON.stringify(res.data)})`);
    if (!res.data.success) throw new Error('Expected success true');
    if (!res.data.appointment || !res.data.appointment.booking_reference) {
      throw new Error('Expected booking reference in returned appointment');
    }
    bookedRef = res.data.appointment.booking_reference;
  });

  // --- CONFLICT & DOUBLE-BOOKING PREVENTION TEST ---
  await test('POST /api/appointments rejects conflicting duplicate slot with HTTP 409', async () => {
    const res = await request('POST', '/api/appointments', {
      name: 'Another Client',
      email: 'client2@example.com',
      phone: '0987654321',
      service: 'Stylist Shaving & Facial',
      date: validDate,
      time: '11:00 AM' // Exact same time slot!
    });
    if (res.statusCode !== 409) throw new Error(`Expected 409 Conflict, got ${res.statusCode}`);
    if (res.data.conflict !== true) throw new Error('Expected conflict flag in response');
  });

  // --- AVAILABILITY UPDATED AFTER BOOKING TEST ---
  await test('GET /api/appointments/availability excludes booked slot from available list', async () => {
    const res = await request('GET', `/api/appointments/availability?date=${validDate}`);
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (res.data.availableSlots.includes('11:00 AM')) {
      throw new Error('Booked slot "11:00 AM" was still returned in availableSlots!');
    }
  });

  // --- NEWSLETTER TESTS ---
  const testNewsletterEmail = `subscriber_${Date.now()}@example.com`;

  await test('POST /api/newsletter/subscribe rejects invalid email with HTTP 400', async () => {
    const res = await request('POST', '/api/newsletter/subscribe', {
      email: 'invalid-email'
    });
    if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
  });

  await test('POST /api/newsletter/subscribe successfully creates new subscriber with HTTP 201', async () => {
    const res = await request('POST', '/api/newsletter/subscribe', {
      email: testNewsletterEmail
    });
    if (res.statusCode !== 201) throw new Error(`Expected 201, got ${res.statusCode}`);
    if (!res.data.success) throw new Error('Expected success true');
  });

  await test('POST /api/newsletter/subscribe handles duplicate subscription gracefully with HTTP 200', async () => {
    const res = await request('POST', '/api/newsletter/subscribe', {
      email: testNewsletterEmail
    });
    if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
    if (!res.data.duplicate) throw new Error('Expected duplicate flag in response');
  });

  console.log('\n====================================================');
  console.log(`  TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
