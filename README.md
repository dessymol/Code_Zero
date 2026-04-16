# CodeZero LMS — Learning Management System

A full-stack Learning Management System for technical education institutions, supporting coding exam delivery, batch management, real-time chat, and performance analytics.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + Tailwind CSS 3 + Framer Motion |
| Backend | Node.js + Express 5 |
| Database | MySQL 8 + Sequelize 6 ORM |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Real-time | Socket.io v4 |
| Code Execution | Judge0 (self-hosted or RapidAPI) |
| Email | Nodemailer |
| Exports | ExcelJS |

---

## Quick Start

### Backend
```bash
cd backend
npm install
cp .env.example .env   # fill in DB, JWT_SECRET, email settings
node server.js
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_URL=http://localhost:3000
npm run dev
```

Open: http://localhost:5173

---

## User Roles

| Role | Login | Dashboard |
|---|---|---|
| Admin | /login | /admin/dashboard |
| Faculty | /login | /faculty/dashboard |
| Student | /login | /student/dashboard |

All three roles use the same unified login page — role is auto-detected from the API response.

---

## Key Features

- **Admin**: Course/Faculty/Student/Batch CRUD, analytics dashboard, chat moderation
- **Faculty**: Question management with test cases, submission evaluation, Excel report generation
- **Student**: Live coding exams with Judge0, anti-cheat monitoring, submission history, score tracking
- **Chat**: Real-time course chat (WebSocket) for Admin and Faculty
- **Auth**: JWT sessions, OTP-based password reset via email

---

## Environment Variables

### Backend `.env`
```
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=codezero_lms
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your@email.com
EMAIL_PASS=your_app_password
CORS_ORIGIN=http://localhost:5173
```

### Frontend `.env`
```
VITE_API_URL=http://localhost:3000
VITE_JUDGE0_URL=http://localhost:2358
```

---

## Documentation

See `CodeZeroLMS_Documentation.docx` for full application documentation including API reference, database schema, security implementation, and deployment guide.

---

*CodeZero LMS · ICTAK · Author: Gokul*
# code_zero
# code_zero
