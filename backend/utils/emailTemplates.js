// backend/utils/emailTemplates.js
const FRONTEND_URL = process.env.FRONTEND_LOGIN_URL || 'http://localhost:3000';

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function studentTemplate({ name = '', email = '', password = '' }) {
  return `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <title>Welcome — Student</title>
  </head>
  <body style="font-family: Arial, Helvetica, sans-serif; background:#f6f8fa; margin:0; padding:0;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:30px 10px;">
        <table width="600" style="background:#ffffff; border-radius:8px; overflow:hidden;">
          <tr style="background:#1976d2; color:#fff;">
            <td style="padding:20px;">
              <h2 style="margin:0">Welcome to ICT Portal</h2>
            </td>
          </tr>
          <tr>
            <td style="padding:24px; color:#111;">
              <p>Hi <strong>${escapeHtml(name || 'Student')}</strong>,</p>
              <p>Your student account has been created. Use these credentials to log in:</p>

              <table cellpadding="6" cellspacing="0" style="margin:10px 0; border:1px solid #eee;">
                <tr><td style="font-weight:600">Email:</td><td>${escapeHtml(email)}</td></tr>
                <tr><td style="font-weight:600">Password:</td><td>${escapeHtml(password)}</td></tr>
              </table>

              <p>
                <a href="${FRONTEND_URL}/student/login" style="display:inline-block;padding:10px 18px;background:#1976d2;color:#fff;text-decoration:none;border-radius:4px;">
                  Go to Student Login
                </a>
              </p>

              <p style="color:#666;font-size:13px">
                For security, please change your password after first login.
              </p>

              <hr style="border:none;border-top:1px solid #eee; margin:18px 0;" />

              <p style="font-size:12px;color:#999">If you did not expect this email, please ignore or contact support.</p>
            </td>
          </tr>
          <tr style="background:#fafafa;">
            <td style="padding:12px; text-align:center; font-size:12px; color:#777;">
              ICT Portal — ICTAK
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
  </html>
  `;
}

function facultyTemplate({ name = '', email = '', password = '' }) {
  return `
  <!doctype html>
  <html>
  <head><meta charset="utf-8"/><title>Welcome — Faculty</title></head>
  <body style="font-family: Inter, Arial, Helvetica, sans-serif; background:#f2f6fb; margin:0; padding:0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 10px;">
      <tr><td align="center">
        <table width="640" style="background:#ffffff;border-radius:10px; overflow:hidden;">
          <tr style="background:#0b1220;color:#fff;">
            <td style="padding:22px;">
              <h1 style="margin:0;font-size:20px;">Faculty Account Activated</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:22px; color:#111;">
              <p>Hello <strong>${escapeHtml(name || 'Faculty')}</strong>,</p>
              <p>Your faculty account is ready. Below are your credentials:</p>

              <div style="margin:12px 0;padding:12px;border-radius:6px;background:#f7fafc;border:1px solid #eef3fb;">
                <div><strong>Email:</strong> ${escapeHtml(email)}</div>
                <div style="margin-top:6px"><strong>Password:</strong> ${escapeHtml(password)}</div>
              </div>

              <p>
                <a href="${FRONTEND_URL}/faculty/login" style="display:inline-block;padding:10px 16px;border-radius:6px;background:#0b1220;color:#fff;text-decoration:none;">
                  Faculty Portal Login
                </a>
              </p>

              <p style="color:#666;font-size:13px;">
                You can manage courses, questions and evaluate submissions after logging in.
              </p>

              <hr style="border:none;border-top:1px solid #eee;margin:18px 0;" />

              <p style="font-size:12px;color:#999">If you didn't expect this email, contact your administrator.</p>
            </td>
          </tr>
          <tr style="background:#fafafa;">
            <td style="padding:12px;text-align:center;color:#777;font-size:12px;">ICT Portal — ICTAK</td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
  </html>
  `;
}

module.exports = { studentTemplate, facultyTemplate };
