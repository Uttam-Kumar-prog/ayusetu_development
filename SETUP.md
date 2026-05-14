# IU Setu (AyuSetu) — Setup & Run Guide

## ⚡ Quick Start

### 1. Prerequisites
- Node.js 18+
- MongoDB Atlas URI (already set in .env)
- (Optional) Gmail account for email notifications

### 2. Backend Setup

```bash
cd backend
npm install
# Edit .env if needed (email, OpenAI key, etc.)
npm run dev
```

Backend starts at: **http://localhost:5000**

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend starts at: **http://localhost:5173**

---

## 🔧 Environment Configuration

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | ✅ | MongoDB Atlas connection string |
| `JWT_SECRET` | ✅ | Change to a strong secret in production |
| `WEB_URL` | ✅ | Frontend URL (for email links) |
| `CORS_ORIGIN` | ✅ | Frontend URL (for CORS) |
| `OPENAI_API_KEY` | Optional | For AI symptom structuring |
| `EMAIL_HOST` | Optional | SMTP host (e.g. smtp.gmail.com) |
| `EMAIL_PORT` | Optional | SMTP port (587) |
| `EMAIL_USER` | Optional | Your email address |
| `EMAIL_PASS` | Optional | Gmail App Password |
| `REMINDER_MINUTES_BEFORE` | Optional | Minutes before appointment to send reminder (default: 15) |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL |
| `VITE_SOCKET_URL` | Backend Socket.IO URL (same host) |

---

## 📧 Email Setup (Gmail)

1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification
3. Search "App passwords" → Create → Copy the 16-char password
4. Set in `.env`:
   ```
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_gmail@gmail.com
   EMAIL_PASS=xxxx xxxx xxxx xxxx
   ```

> Without email config: all emails are **logged to console** only — the app still works fully.

---

## 🤖 AI Setup (Optional)

If you have an OpenAI API key, set it in `.env`:
```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

Without it: the system uses **rule-based symptom structuring** — works without OpenAI.

---

## 📹 Video Consultation

The video consultation uses **WebRTC** (peer-to-peer) with **Socket.IO signaling**.

- No external service required
- Works on localhost (same network)
- For production: add a **TURN server** for users behind strict NAT

### How the video flow works:
1. Patient books a telemedicine appointment
2. A unique room is created automatically
3. Doctor clicks "Start Call" → patient gets email notification
4. Both join via `/consultation/:roomId` — WebRTC connects them
5. Doctor writes prescription during/after the call

---

## 🗂 New Features Added

### Backend
- `services/emailService.js` — Nodemailer with 6 email templates
- `services/signalingService.js` — Socket.IO WebRTC signaling
- `services/reminderScheduler.js` — node-cron reminder system
- `services/aiSymptomService.js` — AI symptom structuring
- `controllers/appointmentController.js` — Start call, remind patient, AI structure
- `controllers/prescriptionController.js` — Create/update, email on issue
- `models/Appointment.js` — Added `aiSymptomSummary` field
- `server.js` — Socket.IO + scheduler integration

### Frontend
- `pages/ConsultationRoom.jsx` — Full WebRTC video call UI
- `pages/DoctorDashboard.jsx` — Prescription form, Start Call, Send Reminder
- `pages/Dashboard.jsx` — Prescriptions tab with PDF download
- `utils/api.js` — New API methods

### New API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/appointments/:id/start` | Doctor starts consultation |
| POST | `/api/appointments/:id/remind-patient` | Doctor sends reminder |
| POST | `/api/appointments/:id/structure-symptoms` | Trigger AI structuring |
| GET  | `/api/prescriptions/appointment/:id` | Get prescription by appointment |

---

## 🧪 Testing Checklist

- [ ] Patient registers and logs in
- [ ] Patient books a telemedicine appointment
- [ ] Doctor receives email notification
- [ ] Doctor dashboard shows appointment with symptoms
- [ ] Doctor clicks "Start Call" → patient receives email
- [ ] Both join consultation room → video connects
- [ ] Mute/unmute and camera toggle work
- [ ] Doctor clicks "Remind Patient" → patient gets email + notification
- [ ] Doctor fills prescription form and saves
- [ ] Patient dashboard shows prescription
- [ ] Patient downloads PDF prescription
- [ ] Reminder emails fire ~15 min before appointment
