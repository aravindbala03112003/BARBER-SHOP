# Barber Shop - Online Appointment & Salon Management Platform

A modern, full-stack Barber Shop web application featuring online appointment scheduling, real-time availability checks, double-booking prevention, persistent MySQL storage, automated customer & admin email notifications, and newsletter subscriptions.

---

## 🌟 Key Features

1. **Seamless Appointment Navigation**
   - Direct navigation from header CTA, mobile drawer, hero section, individual service cards, gallery, and footer.
   - Smooth scrolling with offset positioning (`scroll-margin-top: 100px`) preventing header overlap.
   - Clicking on any service card automatically pre-selects that service in the appointment form.

2. **Real-Time Appointment Scheduling & Availability API**
   - `GET /api/appointments/availability?date=YYYY-MM-DD` dynamically queries MySQL for booked slots.
   - Prevents booking on past dates (native HTML5 date limits + backend enforcement).
   - Enforces business operating hours: **Sunday - Friday, 08:00 AM - 09:00 PM** (Saturday closed).
   - Dynamic time slot dropdown displays only real open slots.

3. **Double-Booking & Conflict Prevention**
   - Database-level unique constraint (`unique_booking_slot`) on `(appointment_date, appointment_time, status)`.
   - Returns clear HTTP 409 Conflict if two clients attempt to book the same slot simultaneously.
   - Form data is preserved upon recoverable errors so customers don't lose typed details.

4. **Persistent MySQL Database Integration**
   - Normalized database schema (`appointments`, `newsletter_subscribers`, `services`).
   - Uses `mysql2/promise` connection pooling with automatic reconnection and SSL support.
   - Auto-executes migrations on boot (`database/schema.sql`).
   - Development mock fallback ensures the app can run offline while seamlessly connecting to MySQL whenever configured.

5. **Transactional Email Notifications**
   - **Admin Notification:** Alerts the salon whenever a new booking is confirmed with customer contact details, service, time, and booking reference.
   - **Customer Confirmation:** Sends a branded HTML confirmation email with appointment details, location, and preparation notes.
   - Graceful delivery handling: failure of SMTP does not drop the database appointment record.

6. **Working Newsletter Subscription**
   - Unique subscriber email enforcement in MySQL.
   - Graceful duplicate handling ("You are already subscribed").
   - Inline feedback and modern toast alerts (no primitive `alert()` popups).

---

## 🏗️ Architecture & Technology Stack

- **Frontend:** Semantic HTML5, CSS3 with Custom Properties, Vanilla JavaScript (ES6+).
- **Backend API:** Node.js, Express.js.
- **Database:** MySQL 5.7+ / 8.0+ (compatible with local MySQL, TiDB Serverless, Aiven, Railway, Clever Cloud).
- **Email:** Nodemailer (SMTP with Gmail, Outlook, Brevo, SendGrid, Mailgun, etc.).
- **Security:** Helmet, CORS, Express-Rate-Limit, parameterized SQL queries.

---

## 🚀 Quick Start (Local Setup)

### 1. Prerequisites
- Node.js (v18.0.0 or later)
- npm (v9.0.0 or later)
- (Optional) MySQL Server or Cloud MySQL connection string

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/aravindbala03112003/BARBER-SHOP.git
cd BARBER-SHOP

# Install dependencies
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Configure your credentials in `.env` (or use defaults for development mode).

### 4. Running the Application
```bash
# Start development server
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Running Automated Tests
```bash
npm test
```
Executes the comprehensive 16-test suite covering health checks, availability calculation, input validations, conflict detection, and newsletter subscriptions.

---

## 🗄️ MySQL Database Setup

### Option A: Free Hosted MySQL (Recommended for Live Deployment)
You can provision a free, persistent MySQL database without a credit card:
1. **TiDB Cloud (Free Forever Serverless)**:
   - Go to [tidbcloud.com](https://tidbcloud.com/) and create a free account.
   - Click **Create Cluster** -> Select **Serverless** (Free 5GB).
   - In **Security**, create a database user and generate a password.
   - Under **Connect**, copy the connection string or host/user/password details.
   - Set in your `.env`:
     ```env
     DB_HOST=gateway01.us-east-1.prod.aws.tidbcloud.com
     DB_PORT=4000
     DB_USER=your_username.root
     DB_PASSWORD=your_password
     DB_NAME=barber_shop
     DB_SSL=true
     ```

### Option B: Local MySQL
Create the database:
```sql
CREATE DATABASE barber_shop CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```
Import schema:
```bash
mysql -u root -p barber_shop < database/schema.sql
```

---

## 📧 Email Notification Setup

### Option A: Gmail (Free)
1. Enable 2-Step Verification in your Google Account.
2. Go to **Security** -> **App Passwords**.
3. Generate a new App Password named "BarberShop".
4. Add to `.env`:
   ```env
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASSWORD=your_16_char_app_password
   EMAIL_FROM="Barber Hair Salon" <your_email@gmail.com>
   BUSINESS_NOTIFICATION_EMAIL=your_admin_email@gmail.com
   ```

### Option B: Brevo (Sendinblue) (Free 300 emails/day)
1. Register at [brevo.com](https://www.brevo.com/).
2. Go to **SMTP & API Keys**.
3. Add to `.env`:
   ```env
   EMAIL_HOST=smtp-relay.brevo.com
   EMAIL_PORT=587
   EMAIL_USER=your_brevo_login
   EMAIL_PASSWORD=your_brevo_smtp_key
   ```

---

## 🌐 Live Deployments

### 🚀 Production Deployment (Vercel Serverless - Recommended)
- **Live URL:** [https://barber-shop-six-lyart.vercel.app](https://barber-shop-six-lyart.vercel.app)
- **Features:** 24/7 instant availability (no cold starts), persistent TiDB Cloud MySQL database, live transactional Gmail confirmation & admin alerts enabled.

### 🛡️ Secondary / Standby Deployment (Render Web Service)
- **Live URL:** [https://barber-shop-0jlh.onrender.com](https://barber-shop-0jlh.onrender.com)
- **Features:** Connected to persistent TiDB Cloud MySQL database; kept active via GitHub Actions keepalive cron (`.github/workflows/keepalive.yml`).

---

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Service health status, uptime, database & email connectivity |
| `GET` | `/api/appointments/availability?date=YYYY-MM-DD` | Returns open time slots for a given date |
| `POST` | `/api/appointments` | Book appointment, save to MySQL, and dispatch dual emails |
| `POST` | `/api/newsletter/subscribe` | Subscribe email to newsletter in MySQL |

---

## 📄 License
ISC License &copy; Barber Shop
