/**
 * Email Notification Service
 * Sends transactional HTML and Plain-Text emails for Admin & Customer
 */

const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.EMAIL_HOST;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;
  const port = process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : 587;
  const secure = process.env.EMAIL_SECURE === 'true' || port === 465;

  if (!host || !user || !pass) {
    console.warn('[Email] SMTP credentials not fully configured. Email notifications will be simulated in development.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass
    },
    tls: {
      rejectUnauthorized: process.env.EMAIL_REJECT_UNAUTHORIZED !== 'false'
    }
  });

  return transporter;
}

/**
 * Verify transporter configuration
 */
async function verifyEmailConfig() {
  const mailer = getTransporter();
  if (!mailer) return { ready: false, message: 'SMTP credentials missing from environment variables' };

  try {
    await mailer.verify();
    console.log('[Email] SMTP server connection verified successfully.');
    return { ready: true, message: 'SMTP connection active' };
  } catch (err) {
    console.warn(`[Email] SMTP verification warning: ${err.message}`);
    return { ready: false, message: err.message };
  }
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}

/**
 * Send booking notification to Business Admin
 */
async function sendAdminNotification(appointment) {
  const mailer = getTransporter();
  const adminEmail = process.env.BUSINESS_NOTIFICATION_EMAIL || process.env.EMAIL_USER;
  const fromEmail = process.env.EMAIL_FROM || `"Barber Salon" <${process.env.EMAIL_USER || 'no-reply@barbershop.com'}>`;

  if (!adminEmail) {
    console.warn('[Email] No BUSINESS_NOTIFICATION_EMAIL configured.');
    return { success: false, reason: 'No admin email configured' };
  }

  const formattedDate = formatDate(appointment.appointment_date);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #121212; color: #e0e0e0; margin: 0; padding: 20px; }
        .card { max-width: 600px; margin: 0 auto; background: #1c1c1c; border: 1px solid #d4a373; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
        .header { background: #d4a373; color: #121212; padding: 25px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px; }
        .content { padding: 30px; }
        .badge { display: inline-block; padding: 6px 12px; background: #2a2a2a; color: #d4a373; border-radius: 4px; font-weight: bold; font-size: 14px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        td { padding: 12px 10px; border-bottom: 1px solid #2a2a2a; }
        td.label { color: #888888; width: 35%; font-weight: 500; }
        td.value { color: #ffffff; font-weight: 600; }
        .notes-box { background: #222222; border-left: 3px solid #d4a373; padding: 12px; margin-top: 20px; font-style: italic; color: #cccccc; }
        .footer { background: #151515; padding: 15px; text-align: center; font-size: 12px; color: #777777; border-top: 1px solid #2a2a2a; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>New Appointment Received</h1>
        </div>
        <div class="content">
          <div class="badge">Ref: ${appointment.booking_reference}</div>
          <p>A new customer has booked an appointment. Details are summarized below:</p>
          <table>
            <tr>
              <td class="label">Customer Name:</td>
              <td class="value">${appointment.customer_name}</td>
            </tr>
            <tr>
              <td class="label">Email Address:</td>
              <td class="value"><a href="mailto:${appointment.customer_email}" style="color: #d4a373; text-decoration: none;">${appointment.customer_email}</a></td>
            </tr>
            <tr>
              <td class="label">Phone Number:</td>
              <td class="value"><a href="tel:${appointment.customer_phone}" style="color: #d4a373; text-decoration: none;">${appointment.customer_phone}</a></td>
            </tr>
            <tr>
              <td class="label">Service Requested:</td>
              <td class="value">${appointment.service_name}</td>
            </tr>
            <tr>
              <td class="label">Stylist / Barber:</td>
              <td class="value">${appointment.barber_name || 'Master Barber'}</td>
            </tr>
            <tr>
              <td class="label">Appointment Date:</td>
              <td class="value">${formattedDate}</td>
            </tr>
            <tr>
              <td class="label">Appointment Time:</td>
              <td class="value">${appointment.appointment_time}</td>
            </tr>
            <tr>
              <td class="label">Status:</td>
              <td class="value" style="color: #4caf50; text-transform: uppercase;">${appointment.status || 'Confirmed'}</td>
            </tr>
          </table>
          ${appointment.notes ? `<div class="notes-box"><strong>Client Note:</strong> "${appointment.notes}"</div>` : ''}
        </div>
        <div class="footer">
          Barber Hair Salon Management &bull; Automated Dispatch System
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
NEW APPOINTMENT BOOKING
-------------------------------------------
Booking Reference: ${appointment.booking_reference}
Customer Name:     ${appointment.customer_name}
Customer Email:    ${appointment.customer_email}
Customer Phone:    ${appointment.customer_phone}
Service:           ${appointment.service_name}
Barber / Stylist:  ${appointment.barber_name || 'Master Barber'}
Date:              ${formattedDate}
Time:              ${appointment.appointment_time}
Status:            ${appointment.status || 'Confirmed'}
Notes:             ${appointment.notes || 'None provided'}
-------------------------------------------
Barber Hair Salon Management System
  `.trim();

  if (!mailer) {
    console.log(`[Email Simulation] Admin Notification dispatched to ${adminEmail} for ${appointment.booking_reference}`);
    return { success: true, simulated: true };
  }

  try {
    const info = await mailer.sendMail({
      from: fromEmail,
      to: adminEmail,
      subject: `New Booking: ${appointment.service_name} - ${appointment.customer_name} (${appointment.appointment_time})`,
      text: textContent,
      html: htmlContent
    });
    console.log(`[Email] Admin notification sent successfully: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Email Error] Failed to send admin notification: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Send confirmation email to Customer
 */
async function sendCustomerConfirmation(appointment) {
  const mailer = getTransporter();
  const fromEmail = process.env.EMAIL_FROM || `"Barber Salon" <${process.env.EMAIL_USER || 'no-reply@barbershop.com'}>`;
  const formattedDate = formatDate(appointment.appointment_date);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #121212; color: #e0e0e0; margin: 0; padding: 20px; }
        .card { max-width: 600px; margin: 0 auto; background: #1c1c1c; border: 1px solid #d4a373; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
        .header { background: #d4a373; color: #121212; padding: 30px 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 26px; text-transform: uppercase; letter-spacing: 2px; }
        .header p { margin: 5px 0 0 0; font-size: 14px; font-weight: 500; }
        .content { padding: 30px; }
        .intro { font-size: 16px; line-height: 1.5; color: #dddddd; margin-bottom: 25px; }
        .ref-box { background: #252525; border: 1px dashed #d4a373; border-radius: 6px; padding: 15px; text-align: center; margin-bottom: 25px; }
        .ref-title { font-size: 12px; color: #aaaaaa; text-transform: uppercase; letter-spacing: 1px; }
        .ref-value { font-size: 22px; font-weight: bold; color: #d4a373; letter-spacing: 2px; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 12px 10px; border-bottom: 1px solid #2a2a2a; }
        td.label { color: #888888; width: 35%; font-weight: 500; }
        td.value { color: #ffffff; font-weight: 600; }
        .info-box { background: #222222; border-left: 3px solid #d4a373; padding: 15px; margin-top: 25px; font-size: 14px; color: #cccccc; line-height: 1.6; }
        .footer { background: #151515; padding: 20px; text-align: center; font-size: 12px; color: #777777; border-top: 1px solid #2a2a2a; }
        .footer a { color: #d4a373; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>Booking Confirmed!</h1>
          <p>Barber &bull; Barbers &amp; Hair Cutting</p>
        </div>
        <div class="content">
          <p class="intro">Dear <strong>${appointment.customer_name}</strong>,</p>
          <p class="intro">Thank you for scheduling your visit with us. Your appointment has been secured in our system.</p>
          
          <div class="ref-box">
            <div class="ref-title">Your Booking Reference</div>
            <div class="ref-value">${appointment.booking_reference}</div>
          </div>

          <table>
            <tr>
              <td class="label">Service:</td>
              <td class="value">${appointment.service_name}</td>
            </tr>
            <tr>
              <td class="label">Stylist:</td>
              <td class="value">${appointment.barber_name || 'Master Barber'}</td>
            </tr>
            <tr>
              <td class="label">Date:</td>
              <td class="value">${formattedDate}</td>
            </tr>
            <tr>
              <td class="label">Time:</td>
              <td class="value">${appointment.appointment_time}</td>
            </tr>
            <tr>
              <td class="label">Location:</td>
              <td class="value">7528 Roberts Ave. Palm Bay, FL 32907</td>
            </tr>
          </table>

          <div class="info-box">
            <strong>Important Salon Notes:</strong><br>
            &bull; Please arrive 5-10 minutes prior to your scheduled time.<br>
            &bull; If you need to reschedule or cancel, please call us at <strong>012 (345) 67 895</strong> at least 2 hours in advance.
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Barber Hair Salon. All Rights Reserved.<br>
          Sunday - Friday, 08:00 AM - 09:00 PM &bull; Call: <a href="tel:01234567895">012 (345) 67 895</a>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
APPOINTMENT CONFIRMATION - BARBER HAIR SALON
=====================================================
Dear ${appointment.customer_name},

Your appointment has been confirmed!

Booking Reference: ${appointment.booking_reference}
Service:           ${appointment.service_name}
Stylist:           ${appointment.barber_name || 'Master Barber'}
Date:              ${formattedDate}
Time:              ${appointment.appointment_time}
Location:          7528 Roberts Ave. Palm Bay, FL 32907

Notes:
- Please arrive 5-10 minutes before your scheduled slot.
- To reschedule or cancel, please call 012 (345) 67 895.

We look forward to serving you!
=====================================================
  `.trim();

  if (!mailer) {
    console.log(`[Email Simulation] Customer Confirmation dispatched to ${appointment.customer_email} for ${appointment.booking_reference}`);
    return { success: true, simulated: true };
  }

  try {
    const info = await mailer.sendMail({
      from: fromEmail,
      to: appointment.customer_email,
      subject: `Appointment Confirmed: ${appointment.service_name} at Barber Salon [${appointment.booking_reference}]`,
      text: textContent,
      html: htmlContent
    });
    console.log(`[Email] Customer confirmation sent successfully: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Email Error] Failed to send customer confirmation: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * High-level method to send both admin & customer notifications
 */
async function dispatchAppointmentEmails(appointment) {
  const [adminResult, customerResult] = await Promise.allSettled([
    sendAdminNotification(appointment),
    sendCustomerConfirmation(appointment)
  ]);

  const adminSuccess = adminResult.status === 'fulfilled' && adminResult.value.success;
  const customerSuccess = customerResult.status === 'fulfilled' && customerResult.value.success;

  return {
    adminDelivered: adminSuccess,
    customerDelivered: customerSuccess,
    anyDelivered: adminSuccess || customerSuccess
  };
}

module.exports = {
  verifyEmailConfig,
  sendAdminNotification,
  sendCustomerConfirmation,
  dispatchAppointmentEmails
};
