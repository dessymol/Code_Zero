# CodeZero LMS

A full-stack Learning Management System built for technical education institutions. CodeZero delivers live coding exams, AI-assisted test case generation, real-time course chat, batch management, and performance analytics — purpose-built for ICTAK's coding evaluation workflows.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Features by Role](#features-by-role)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [LLM Provider Configuration](#llm-provider-configuration)
- [Judge0 Configuration](#judge0-configuration)
- [API Overview](#api-overview)
- [Database Schema](#database-schema)
- [First-Run Setup](#first-run-setup)
- [Known Issues & Recommendations](#known-issues--recommendations)
- [Authors](#authors)

---

## Tech Stack

| Layer           | Technology                                                  |
| --------------- | ----------------------------------------------------------- |
| Frontend        | React 19 + Vite 7 + Tailwind CSS 3 + Framer Motion + MUI    |
| Backend         | Node.js + Express 5                                         |
| Database        | MySQL 8 + Sequelize 6 ORM                                   |
| Auth            | JWT (jsonwebtoken) + bcryptjs                               |
| Real-time       | Socket.io v4                                                |
| Code Execution  | Judge0 (RapidAPI or self-hosted)                            |
| AI — Feedback   | Gemini 2.5 Flash (primary) / Groq / Ollama (local fallback) |
| AI — Test Cases | Same LLM service with provider fallback chain               |
| Email           | Nodemailer (SMTP / Gmail App Password)                      |
| Exports         | ExcelJS                                                     |
| API Docs        | Swagger UI (`/api-docs`)                                    |

---

## Architecture Overview

```
┌─────────────────────────────┐
│      React Frontend         │  Vite dev server → port 5173
│  (Role-based SPA with       │
│   JWT in localStorage)      │
└────────────┬────────────────┘
             │ HTTP + WebSocket
┌────────────▼────────────────┐
│   Express 5 Backend         │  port 3000
│                             │
│  ┌──────────────────────┐   │
│  │  Auth Middleware      │   │  JWT Bearer token validation
│  │  (studentAuth /       │   │  Role: admin / faculty / student
│  │   facultyAuth /       │   │         / super_admin
│  │   adminAuth)          │   │
│  └──────────────────────┘   │
│                             │
│  ┌──────────────────────┐   │
│  │  Socket.io           │   │  Course chat rooms (joinCourse /
│  │  (chat/socket.js)    │   │  sendMessage / chatHistory)
│  └──────────────────────┘   │
│                             │
│  ┌──────────────────────┐   │
│  │  LLM Service         │   │  Gemini → Groq → Ollama
│  │  (with fallback      │   │  Used for: submission feedback
│  │   chain)             │   │  and test case generation
│  └──────────────────────┘   │
│                             │
│  ┌──────────────────────┐   │
│  │  Judge0 Service      │   │  Code execution sandbox
│  │  (RapidAPI or local) │   │  Supports 15+ languages
│  └──────────────────────┘   │
└────────────┬────────────────┘
             │ Sequelize ORM
┌────────────▼────────────────┐
│  MySQL 8 Database           │
└─────────────────────────────┘
```

---

## Features by Role

### Super Admin

- All admin capabilities
- Manage additional admin accounts via `/admin/add-admin`
- Dedicated super admin dashboard

### Admin

- **Course Management** — create, update, delete courses; assign faculties and enroll students
- **Batch Management** — group students into batches within a course
- **Faculty & Student Management** — full CRUD with account activation/deactivation; bulk student import via CSV/Excel upload (Multer)
- **Question Banks** — view all questions across courses
- **Submission Monitoring** — view all submissions per course, filter by batch
- **Chat** — monitor and participate in course chat rooms
- **Audit Logs** — read audit trail of all significant actions
- **Analytics Dashboard** — submission stats, course activity, student performance charts

### Faculty

- **Question Management** — create coding questions with title, description, sample I/O, and language
- **AI Test Case Generation** — LLM-generated test cases (draft + approve workflow); faculty can edit before saving
- **Test Case Verification** — run questions against Judge0 to validate test cases before publishing
- **Batch Toggling** — activate/deactivate individual questions per batch independently
- **Submission Evaluation** — review student submissions, approve or override scores
- **LLM Feedback** — post-submission AI feedback generated asynchronously per student
- **Reports & Exports** — download Excel reports: per-batch, per-subbatch, combined, and personal submissions
- **Course Chat** — real-time per-course messaging with admin

### Student

- **Live Coding Exam** — full in-browser IDE (`/student/exam/:courseId`) with syntax highlighting
- **Code Execution** — run code against test cases via Judge0 before submitting
- **Anti-cheat Monitoring** — fullscreen enforcement on exam start; tab-switch / window blur detection; forbidden keys blocked (Alt, Ctrl, Fn, Tab, Esc, F1–F12); copy/paste disabled in editor; 5-item pre-exam acknowledgement checklist; configurable violation limit per course; exam auto-terminated on threshold breach
- **Submission History** — view past submissions with status and score
- **AI Feedback** — read LLM-generated qualitative feedback on each submission
- **Score Dashboard** — performance charts and metrics across courses
- **Profile Management** — update personal info and password

### All Roles

- Unified login page at `/login` — Admin/Faculty use `POST /api/v1/users/login`; Students use `POST /api/students/login`. Role is auto-detected and the client is redirected to the correct dashboard.
- OTP-based password reset via email (`/forgot-password`)
- JWT sessions (configurable expiry via `JWT_EXPIRES_IN`)

---

## Project Structure

```
Code_Zero-main/
├── backend/
│   ├── server.js                  # Express app, Socket.io, route mounting, Swagger
│   ├── config/
│   │   └── connection.js          # Sequelize + MySQL connection
│   ├── models/
│   │   ├── index.js               # Model registry + all associations
│   │   ├── users.js               # Admin / Faculty accounts
│   │   ├── student.js             # Student accounts
│   │   ├── courses.js
│   │   ├── questions.js
│   │   ├── testcases.js
│   │   ├── testresults.js
│   │   ├── submissions.js
│   │   ├── submissionfeedback.js  # LLM feedback per submission
│   │   ├── results.js
│   │   ├── batches.js
│   │   ├── batchstudents.js
│   │   ├── questionbatches.js     # Per-question per-batch toggle
│   │   ├── courseMessages.js      # Chat messages
│   │   ├── coursefaculties.js
│   │   ├── auditlog.js / auditlogs.js
│   │   └── systemconfig.js        # Init state flag
│   ├── controllers/
│   │   ├── submissionController.js  # Code submit, execute, feedback, violations
│   │   ├── questionController.js    # CRUD + batch toggle + student-facing
│   │   ├── testcaseController.js    # LLM generate → approve → list → delete
│   │   ├── courseController.js
│   │   ├── facultyController.js
│   │   ├── studentController.js
│   │   ├── userController.js
│   │   ├── resultController.js
│   │   └── passwordResetController.js
│   ├── routes/
│   │   ├── submissionRoutes.js
│   │   ├── questionRoutes.js
│   │   ├── courseroutes.js
│   │   ├── studentRoutes.js
│   │   ├── userroutes.js
│   │   ├── resultRoutes.js
│   │   ├── auditRoutes.js
│   │   ├── passwordReset.js
│   │   └── setupRoutes.js          # First-run setup + DB sync
│   ├── services/
│   │   ├── llmServices.js          # Provider fallback chain: generate feedback & test cases
│   │   ├── judge0Service.js        # Code execution wrapper (RapidAPI + self-hosted)
│   │   ├── auditService.js         # Audit log writer
│   │   ├── auditLogService.js
│   │   ├── initState.js            # System init flag (SystemConfig table)
│   │   └── adapters/
│   │       ├── geminiAdapters.js   # Google Gemini 2.5 Flash
│   │       ├── groqAdapter.js      # Groq (OpenAI-compatible API)
│   │       └── ollamaAdapter.js    # Local Ollama (default: qwen2.5-coder:3b)
│   ├── Middleware/
│   │   ├── authmiddleware.js       # authMiddleware, studentAuth, facultyAuth, adminAuth
│   │   ├── initMiddleware.js       # requireInitialized guard
│   │   └── error.js
│   ├── chat/
│   │   ├── controller.js
│   │   ├── routes.js
│   │   └── socket.js               # Socket.io handlers: joinCourse, sendMessage, chatHistory
│   ├── excelexports/
│   │   ├── controllers/exportController.js  # Batch/subbatch/combined Excel exports
│   │   ├── routes/exportRoutes.js
│   │   └── index.js
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # React Router v7 + lazy-loaded routes
│   │   ├── main.jsx
│   │   ├── pages/
│   │   │   ├── AdminDashboard.jsx
│   │   │   ├── SuperAdminDashboard.jsx
│   │   │   ├── FacultyDashboard.jsx
│   │   │   ├── StudentDashboard.jsx
│   │   │   ├── Codingpage.jsx          # Live exam IDE
│   │   │   ├── ManageQuestions.jsx     # Faculty question + test case UI
│   │   │   ├── FacultyEvaluate.jsx     # Submission review + score override
│   │   │   ├── StudentFeedback.jsx     # LLM feedback viewer
│   │   │   ├── StudentScore.jsx        # Score charts
│   │   │   ├── BatchManagement.jsx
│   │   │   ├── ChatRoom.jsx            # Admin-side chat
│   │   │   ├── FacultyChatView.jsx
│   │   │   ├── AdminCourseSubmissions.jsx
│   │   │   ├── AdminQuestionBanks.jsx
│   │   │   └── ... (other pages)
│   │   ├── components/
│   │   │   ├── ProtectedRoute.jsx      # Role-based route guard
│   │   │   ├── AuthShell.jsx
│   │   │   ├── Pagination.jsx
│   │   │   ├── PageHeader.jsx
│   │   │   ├── LoadingSpinner.jsx
│   │   │   ├── Skeleton.jsx
│   │   │   └── EmptyState.jsx
│   │   ├── context/
│   │   │   ├── LocaleContext.jsx
│   │   │   └── ToastContext.jsx
│   │   ├── services/
│   │   │   └── api.js                  # Axios instance with base URL
│   │   ├── service/
│   │   │   └── judge0Service.js        # Frontend Judge0 polling helpers
│   │   └── utils/
│   │       ├── auth.js
│   │       └── studentScoreMetrics.js
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── start-server.bat               # Windows helper: kills port 3000, starts nodemon
└── package-lock.json
```

---

## Prerequisites

- **Node.js** v18+ (backend uses Express 5; `node` v25 is listed as a dev dependency)
- **MySQL 8** running locally or remotely
- **Judge0** — either a [RapidAPI subscription](https://rapidapi.com/judge0-official/api/judge0-ce) or a [self-hosted Judge0 instance](https://github.com/judge0/judge0)
- **LLM API key** — at least one of: Google Gemini API key, Groq API key, or Ollama running locally

---

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/your-org/code-zero.git
cd code-zero
```

**Backend**

```bash
cd backend
npm install
cp .env.example .env
# Fill in your values — see Environment Variables below
```

**Frontend**

```bash
cd ../frontend
npm install
```

### 2. Create the MySQL database

```sql
CREATE DATABASE codingdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. Start the backend

```bash
# From /backend
node server.js
# or for development with auto-reload:
npx nodemon server.js
```

On Windows you can also use the helper script from the repo root:

```bat
start-server.bat
```

Sequelize will auto-sync models on first start. The server will print:

```
Server running at http://localhost:3000
```

### 4. Run first-time setup

On first boot, visit `/setup` in the frontend or call the setup API to create the initial Super Admin account. The backend tracks whether the system has been initialized via the `system_config` table.

```
GET  /auth/status          → { initialized: false }
POST /setup/create-admin   → creates first Super Admin
```

After setup, the `/setup` route is disabled and all further admin creation goes through the Super Admin dashboard.

### 5. Start the frontend

```bash
cd frontend
npm run dev
```

Open: **http://localhost:5173**

The Swagger API docs are available at: **http://localhost:3000/api-docs**

---

## Environment Variables

### Backend — `backend/.env`

```env
# Server
PORT=3000

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_db_password
DB_NAME=codingdb
MYSQL_PORT=3306

# Auth
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# CORS (comma-separated for multiple origins)
CORS_ORIGIN=http://localhost:5173

# Email (Nodemailer / Gmail App Password)
EMAIL_USER=your@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=your@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
FRONTEND_LOGIN_URL=http://localhost:5173

# Judge0 — RapidAPI (comment out if self-hosting)
JUDGE0_URL=https://judge029.p.rapidapi.com
RAPIDAPI_KEY=your_rapidapi_key
RAPIDAPI_HOST=judge029.p.rapidapi.com

# Judge0 — Self-hosted (use instead of RapidAPI vars)
# JUDGE0_URL=http://localhost:2358

# LLM Provider  ("gemini" | "groq" | "local")
LLM_PROVIDER=gemini

# Gemini
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash

# Groq (optional fallback)
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.1-8b-instant
GROQ_BASE_URL=https://api.groq.com/openai/v1

# Ollama / Local LLM (optional fallback)
LOCAL_LLM_URL=http://localhost:11434
LOCAL_LLM_MODEL=qwen2.5-coder:3b
LOCAL_LLM_TIMEOUT_MS=60000

# Test case generation
TESTCASE_COUNT=5

# First-run setup protection (optional)
# SETUP_SECRET=some_secret_string
```

### Frontend — `frontend/.env`

```env
VITE_API_URL=http://localhost:3000
VITE_JUDGE0_URL=http://localhost:2358

# Only needed if using RapidAPI-hosted Judge0 from the frontend directly
VITE_RAPIDAPI_KEY=your_rapidapi_key
VITE_RAPIDAPI_HOST=judge0-ce.p.rapidapi.com
```

---

## LLM Provider Configuration

CodeZero uses a **provider fallback chain** for all AI features (submission feedback and test case generation). The order is:

1. The `LLM_PROVIDER` env var selects the primary provider.
2. On failure, the service automatically retries the remaining two providers.
3. If all three fail, a descriptive error is returned to the UI.

| Provider | Env Var          | Notes                                                           |
| -------- | ---------------- | --------------------------------------------------------------- |
| `gemini` | `GEMINI_API_KEY` | Default. Uses `gemini-2.5-flash`.                               |
| `groq`   | `GROQ_API_KEY`   | OpenAI-compatible endpoint.                                     |
| `local`  | `LOCAL_LLM_URL`  | Ollama. Default model: `qwen2.5-coder:3b`. Works fully offline. |

Per-faculty provider preference is also stored on the `User` model (`llm_provider` field), allowing individual faculty members to override the global provider.

---

## Judge0 Configuration

Code execution is handled by [Judge0](https://github.com/judge0/judge0). Two modes are supported:

**RapidAPI (hosted):** Set `RAPIDAPI_KEY`, `RAPIDAPI_HOST`, and `JUDGE0_URL` to the RapidAPI endpoint. The service automatically adds the required `X-RapidAPI-Key` and `X-RapidAPI-Host` headers.

**Self-hosted:** Set only `JUDGE0_URL=http://localhost:2358` and leave `RAPIDAPI_KEY` unset. No extra headers are added.

Supported languages include Python 3, Python 2, JavaScript (Node.js), Java, C, C++, C#, Ruby, PHP, Go, Kotlin, Rust, Swift, TypeScript, SQL, and Bash.

---

## API Overview

All routes are prefixed with `/api`. Protected routes require `Authorization: Bearer <token>`.

| Method  | Path                                         | Auth          | Description                                  |
| ------- | -------------------------------------------- | ------------- | -------------------------------------------- |
| `GET`   | `/auth/status`                               | —             | Check if system is initialized               |
| `POST`  | `/setup/create-admin`                        | —             | First-run Super Admin creation               |
| `POST`  | `/api/v1/users/login`                        | —             | Admin / Faculty login (returns role + token) |
| `POST`  | `/api/students/login`                        | —             | Student login (separate endpoint)            |
| `POST`  | `/api/password-reset/request`                | —             | Send OTP to email                            |
| `POST`  | `/api/password-reset/verify`                 | —             | Verify OTP + reset password                  |
| `GET`   | `/api/courses`                               | Admin/Faculty | List courses                                 |
| `POST`  | `/api/courses`                               | Admin         | Create course                                |
| `POST`  | `/api/students/upload`                       | Admin         | Bulk student import via CSV/Excel            |
| `GET`   | `/api/questions/bank/:courseId`              | Faculty       | Question bank for course                     |
| `POST`  | `/api/questions/add`                         | Faculty       | Create question                              |
| `POST`  | `/api/questions/:id/testcases/generate`      | Faculty       | LLM-generate draft test cases                |
| `POST`  | `/api/questions/:id/testcases/approve`       | Faculty       | Save approved test cases to DB               |
| `GET`   | `/api/questions/course/:courseId`            | Student       | Get visible questions for exam               |
| `POST`  | `/api/submissions/execute`                   | Student       | Run code (no save)                           |
| `POST`  | `/api/submissions/submit`                    | Student       | Submit code + trigger LLM feedback           |
| `GET`   | `/api/submissions/:id/feedback`              | Student       | Poll for LLM feedback                        |
| `GET`   | `/api/submissions/student/feedback`          | Student       | All feedback for logged-in student           |
| `PATCH` | `/api/submissions/:id/approve`               | Faculty       | Approve submission                           |
| `PATCH` | `/api/submissions/:id/score`                 | Faculty       | Override score                               |
| `GET`   | `/api/submissions/exam-status/:courseId`     | Student       | Check violation count + block status         |
| `POST`  | `/api/submissions/exam-violations/:courseId` | Student       | Record a tab-switch violation                |
| `GET`   | `/api/export/courses`                        | Faculty/Admin | List exportable courses                      |
| `GET`   | `/api/export/batch/:batchId`                 | Faculty/Admin | Download batch Excel report                  |
| `GET`   | `/api/chats/:courseId/messages`              | Admin/Faculty | Fetch chat history                           |
| `GET`   | `/api/audit-logs`                            | Admin         | Paginated audit log                          |
| `GET`   | `/health`                                    | —             | Health check                                 |
| `GET`   | `/api-docs`                                  | —             | Swagger UI                                   |

Full API documentation with request/response schemas is available at `/api-docs` when the backend is running.

---

## Database Schema

Core tables and their relationships:

```
users            — Admin and Faculty accounts (role: admin | faculty | super_admin)
students         — Student accounts (separate table, separate auth)
courses          ←→ users      (many-to-many via course_faculties)
courses          ←→ students   (many-to-many via course_students)
batches          → courses
batch_students   → batches + students
questions        → courses
testcases        → questions
question_batches → questions + batches   (per-question per-batch toggle)
submissions      → questions + students
test_results     → submissions + testcases
submission_feedback → submissions        (LLM-generated, async)
results          → submissions
course_messages  → courses + users       (chat)
audit_logs       → users
system_config                            (initialization flag)
```

Sequelize auto-syncs the schema on startup. For production, use `sequelize-cli` migrations.

---

## First-Run Setup

On a fresh database, the backend detects zero users and blocks all protected routes until setup is complete.

1. Start the backend — it will print `Server running` but all `/api/*` routes will return `503 Not Initialized`.
2. Navigate to `http://localhost:5173/setup` in the browser.
3. Fill in the Super Admin name, email, and a strong password (min 8 chars, upper + lower + number + special).
4. After creation, the `system_config` table is set to `initialized: true` and the `/setup` route is permanently disabled.

To reset a dev environment: truncate all tables or drop and recreate the database, then restart the backend.

---

## Known Issues & Recommendations

These are open items documented during development — useful context for any new contributor.

| Issue                                                      | Severity | Notes                                                                                                                          |
| ---------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| JWT stored in `localStorage`                               | Medium   | Vulnerable to XSS. Consider `HttpOnly` cookies in production.                                                                  |
| No refresh token flow                                      | Medium   | Tokens expire and force re-login. A refresh token endpoint would improve UX.                                                   |
| No email verification on signup                            | Medium   | New accounts are immediately active. Add confirmation step before first login.                                                 |
| Chat messages not paginated on backend                     | Medium   | `GET /api/chats/:courseId/messages` returns up to 200 messages with no cursor. Add cursor-based pagination for large channels. |
| `FacultyLogin.jsx` and `StudentLogin.jsx` are orphan files | Low      | These exist in `src/pages/` but are not wired into routing. Remove or connect them.                                            |
| Swagger docs partially annotated                           | Low      | Only some routes have JSDoc `@swagger` annotations. Complete coverage would make `/api-docs` more useful.                      |
| No student-facing chat                                     | Low      | Students can only read scores and feedback — no announcement/Q&A channel from faculty.                                         |
| `ChatRoom.jsx` uses `window.location.reload()`             | Low      | Refactor to disconnect/reconnect Socket.io without a full page reload.                                                         |

---

## Authors

Alishia · Anusree · Dessymol · Gowri · Prince

Built for ICTAK (ICT Academy of Kerala) — CodeZero LMS
