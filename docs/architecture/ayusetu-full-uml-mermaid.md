# AyuSetu Full UML and Architecture (Mermaid)

This document captures the current architecture from the codebase in:
- `backend` (Express + MongoDB + Socket.IO)
- `frontend` (React + Vite)

## 1) System Context Diagram

```mermaid
flowchart LR
    Patient["Patient User"] --> FE["AyuSetu Frontend (React SPA)"]
    Doctor["Doctor User"] --> FE
    Admin["Admin User"] --> FE
    Pharmacy["Pharmacy User"] --> FE

    FE --> API["AyuSetu Backend API (Express)"]
    FE <-->|WebRTC Signaling Poll/Socket| API

    API --> DB["MongoDB Atlas"]
    API --> SMTP["SMTP Email Provider"]
    API --> OpenAI["OpenAI API (Optional)"]
    API --> Razorpay["Razorpay API"]
    FE --> Google["Google OAuth / GIS"]
```

## 2) Container / Runtime Diagram

```mermaid
flowchart TB
    subgraph Browser["Client Browser"]
      SPA["React SPA\nAuthContext + ProtectedRoute\nPages + ChatAssistantWidget"]
      LocalStore["LocalStorage / SessionStorage"]
      SPA <--> LocalStore
    end

    subgraph FrontendHosting["Vercel Frontend"]
      ViteBuild["Built Static Assets\n(index.html, JS, CSS)"]
    end

    subgraph BackendHosting["Vercel Backend / Node Runtime"]
      Express["Express App\nhelmet + cors + rate-limit + error middleware"]
      Socket["Socket.IO Signaling Server\n(join-room, offer/answer/ice)"]
      Scheduler["Reminder Scheduler (cron-like interval)"]
    end

    subgraph Data["Database"]
      Mongo["MongoDB Collections"]
    end

    subgraph External["External Services"]
      Mail["SMTP / Nodemailer"]
      GPT["OpenAI (chat/vision optional)"]
      RP["Razorpay Orders + Signature Verify"]
      GAuth["Google Token Verify"]
    end

    SPA --> ViteBuild
    ViteBuild --> Express
    SPA <-->|HTTP JSON APIs| Express
    SPA <-->|Socket/WebRTC signaling| Socket
    Express --> Mongo
    Socket --> Mongo
    Scheduler --> Mongo
    Express --> Mail
    Express --> GPT
    Express --> RP
    Express --> GAuth
```

## 3) Backend Module Diagram

```mermaid
flowchart LR
    subgraph Routes
      AuthR["/api/auth"]
      SymR["/api/symptoms"]
      DocR["/api/doctors"]
      AptR["/api/appointments"]
      ChatR["/api/chats"]
      RxR["/api/prescriptions"]
      ThR["/api/therapy"]
      PhR["/api/pharmacy"]
      AdmR["/api/admin"]
      AnR["/api/analytics"]
    end

    subgraph Controllers
      AuthC["authController"]
      SymC["symptomController"]
      DocC["doctorController"]
      AptC["appointmentController"]
      ChatC["chatController"]
      RxC["prescriptionController"]
      ThC["therapyController"]
      PhC["pharmacyController"]
      AdmC["adminController"]
      AnC["analyticsController"]
    end

    subgraph Services
      OTPS["otpVerificationService / otpService"]
      RFS["refreshTokenService"]
      GS["googleAuthService"]
      RS["razorpayService"]
      AIS["aiService / aiSymptomService"]
      DAS["documentAnalysisService"]
      PMS["patientSymptomMemoryService"]
      NS["notificationService"]
      ES["emailService"]
      SS["signalingService"]
      REM["reminderScheduler"]
      ALS["auditLogService"]
    end

    subgraph Middleware
      MW1["auth.protect + authorize"]
      MW2["validate + express-validator"]
      MW3["errorHandler"]
      MW4["rate-limit + cors + helmet"]
    end

    subgraph Models
      M["Mongoose Models"]
    end

    AuthR-->AuthC
    SymR-->SymC
    DocR-->DocC
    AptR-->AptC
    ChatR-->ChatC
    RxR-->RxC
    ThR-->ThC
    PhR-->PhC
    AdmR-->AdmC
    AnR-->AnC

    Controllers --> Services
    Controllers --> M
    Routes --> Middleware
    Controllers --> MW3
```

## 4) Database ER Diagram (Current Collections)

```mermaid
erDiagram
    USER {
      ObjectId _id PK
      string fullName
      string email UK
      string phone UK
      string passwordHash
      string authProvider
      string googleSub
      string role
      bool isVerified
      bool isActive
      number failedLoginAttempts
      date lockUntil
      date lastPasswordChangedAt
      object profile
      object doctorProfile
      object pharmacyProfile
      date lastLoginAt
      date createdAt
      date updatedAt
    }

    ROLE {
      ObjectId _id PK
      string key UK
      string name
      bool isActive
      date createdAt
      date updatedAt
    }

    LOGIN_PROVIDER {
      ObjectId _id PK
      ObjectId userId FK
      string provider
      string providerUserId
      string email
      bool isPrimary
      date linkedAt
      date createdAt
      date updatedAt
    }

    OTP_VERIFICATION {
      ObjectId _id PK
      ObjectId userId FK
      string email
      string purpose
      string otpHash
      date expiresAt
      date consumedAt
      number attempts
      number maxAttempts
      date resendAvailableAt
      number sentCount
      object metadata
      date createdAt
      date updatedAt
    }

    OTP_CODE {
      ObjectId _id PK
      string phone
      string purpose
      string codeHash
      date expiresAt
      number attempts
      date consumedAt
      date createdAt
      date updatedAt
    }

    REFRESH_TOKEN {
      ObjectId _id PK
      ObjectId userId FK
      string tokenHash
      date expiresAt
      date revokedAt
      string replacedByTokenHash
      string createdByIp
      string revokedByIp
      string userAgent
      date createdAt
      date updatedAt
    }

    APPOINTMENT_PAYMENT {
      ObjectId _id PK
      ObjectId patientId FK
      ObjectId doctorId FK
      string slotDate
      string slotTime
      string consultationType
      string symptomSummary
      number amount
      string currency
      string receipt UK
      string razorpayOrderId UK
      string razorpayPaymentId
      string razorpaySignature
      string status
      string failureReason
      date expiresAt
      date createdAt
      date updatedAt
    }

    APPOINTMENT {
      ObjectId _id PK
      string appointmentCode UK
      ObjectId patientId FK
      ObjectId doctorId FK
      string slotDate
      string slotTime
      date startAt
      date endAt
      string consultationType
      string symptomSummary
      string aiSymptomSummary
      object meeting
      object payment
      string status
      string notesByDoctor
      string cancelReason
      date createdAt
      date updatedAt
    }

    DOCTOR_AVAILABILITY {
      ObjectId _id PK
      ObjectId doctorId FK
      string date
      string timezone
      array slots
      date createdAt
      date updatedAt
    }

    CONSULTATION_SIGNAL {
      ObjectId _id PK
      string roomId
      ObjectId appointmentId FK
      ObjectId fromUserId FK
      string fromRole
      string fromUserName
      string type
      object payload
      date createdAt
      date updatedAt
    }

    SYMPTOM_HISTORY {
      ObjectId _id PK
      ObjectId userId FK
      array symptoms
      string lifestyle
      string language
      string inputMode
      object triage
      array recommendations
      string doshaImbalance
      string source
      ObjectId reviewedByDoctorId FK
      date timestamp
      date createdAt
      date updatedAt
    }

    PATIENT_SYMPTOM_MEMORY {
      ObjectId _id PK
      ObjectId userId FK, UK
      array topSymptoms
      array likelyCauses
      string lastAssistantName
      array entries
      date createdAt
      date updatedAt
    }

    CHAT_SESSION {
      ObjectId _id PK
      ObjectId patientId FK
      ObjectId doctorId FK
      string channel
      string assistantName
      string status
      ObjectId linkedAssessmentId FK
      array messages
      date createdAt
      date updatedAt
    }

    PRESCRIPTION {
      ObjectId _id PK
      ObjectId appointmentId FK
      ObjectId patientId FK
      ObjectId doctorId FK
      array diagnosis
      array medicines
      string advice
      date followUpDate
      string qrToken UK
      string pdfUrl
      string status
      date issuedAt
      date createdAt
      date updatedAt
    }

    THERAPY_PLAN {
      ObjectId _id PK
      ObjectId patientId FK
      ObjectId doctorId FK
      string therapyType
      string startDate
      number totalSessions
      array sessions
      number progressPercent
      string status
      date createdAt
      date updatedAt
    }

    MEDICINE_INVENTORY {
      ObjectId _id PK
      ObjectId pharmacyId FK, UK
      array items
      date createdAt
      date updatedAt
    }

    NOTIFICATION {
      ObjectId _id PK
      ObjectId userId FK
      string type
      string title
      string body
      string channel
      object payload
      string status
      date sentAt
      date readAt
      date createdAt
      date updatedAt
    }

    AUDIT_LOG {
      ObjectId _id PK
      ObjectId userId FK
      string action
      string status
      string ip
      string userAgent
      object metadata
      date createdAt
      date updatedAt
    }

    USER ||--o{ LOGIN_PROVIDER : has
    USER ||--o{ REFRESH_TOKEN : owns
    USER ||--o{ OTP_VERIFICATION : receives
    USER ||--o{ SYMPTOM_HISTORY : submits
    USER ||--|| PATIENT_SYMPTOM_MEMORY : accumulates
    USER ||--o{ CHAT_SESSION : participates
    USER ||--o{ APPOINTMENT : books_patient
    USER ||--o{ APPOINTMENT : serves_doctor
    USER ||--o{ APPOINTMENT_PAYMENT : pays_patient
    USER ||--o{ APPOINTMENT_PAYMENT : receives_doctor
    USER ||--o{ DOCTOR_AVAILABILITY : publishes
    USER ||--o{ PRESCRIPTION : receives_patient
    USER ||--o{ PRESCRIPTION : issues_doctor
    USER ||--o{ THERAPY_PLAN : follows_patient
    USER ||--o{ THERAPY_PLAN : manages_doctor
    USER ||--|| MEDICINE_INVENTORY : owns_pharmacy
    USER ||--o{ NOTIFICATION : receives
    USER ||--o{ AUDIT_LOG : logged

    APPOINTMENT ||--o{ CONSULTATION_SIGNAL : emits
    APPOINTMENT ||--o| PRESCRIPTION : results_in
    APPOINTMENT ||--o{ NOTIFICATION : triggers
    SYMPTOM_HISTORY ||--o{ CHAT_SESSION : linked_assessment
```

## 5) Authentication Sequence (Signup/Login/Google + OTP + JWT)

```mermaid
sequenceDiagram
    participant U as User
    participant FE as React Frontend
    participant BE as Auth API
    participant G as Google TokenInfo
    participant DB as MongoDB
    participant SMTP as Email Service

    alt Local Signup/Login
      U->>FE: Submit email/password (or signup form)
      FE->>BE: POST /api/auth/signup or /login
      BE->>DB: Validate user/password & lock rules
    else Google Login
      U->>FE: Continue with Google
      FE->>BE: POST /api/auth/google-login (credential)
      BE->>G: Verify ID token
      G-->>BE: token payload (email/sub)
      BE->>DB: Find/Create user + LoginProvider
    end

    BE->>DB: Create OtpVerification (hashed OTP, expiry, attempts)
    BE->>SMTP: Send OTP email
    BE-->>FE: otpFlowToken + resendAfterSeconds

    U->>FE: Enter OTP
    FE->>BE: POST /api/auth/verify-otp
    BE->>DB: Verify OTP hash + attempts + expiry + one-time consume
    BE->>DB: Create RefreshToken (hashed)
    BE-->>FE: accessToken + refreshToken + user
    FE->>FE: Persist tokens + user in storage
```

## 6) Appointment Booking Sequence with Razorpay

```mermaid
sequenceDiagram
    participant P as Patient
    participant FE as DoctorProfile Modal
    participant BE as Appointments API
    participant RP as Razorpay
    participant DB as MongoDB
    participant SMTP as Email

    P->>FE: Select date/time + note
    FE->>BE: POST /api/appointments/payment/order
    BE->>DB: Validate doctor + slot + fee
    BE->>RP: Create order(amount, receipt)
    RP-->>BE: orderId
    BE->>DB: Save AppointmentPayment(status=CREATED)
    BE-->>FE: paymentIntentId + orderId + keyId + amount

    FE->>RP: Open Checkout(orderId)
    RP-->>FE: paymentId + signature + orderId

    FE->>BE: POST /api/appointments/payment/verify
    BE->>BE: Verify HMAC signature
    BE->>DB: Lock slot AVAILABLE->BOOKED
    BE->>DB: Create Appointment(status=CONFIRMED,payment=PAID)
    BE->>DB: Link slot.appointmentId
    BE->>DB: Mark AppointmentPayment VERIFIED
    BE->>SMTP: Send patient/doctor booking emails
    BE-->>FE: Appointment confirmed
```

## 7) Consultation Signaling / WebRTC Sequence

```mermaid
sequenceDiagram
    participant D as Doctor Browser
    participant P as Patient Browser
    participant API as REST Signals API
    participant WS as Socket.IO Signaling
    participant DB as MongoDB

    D->>API: GET /room/:roomId/access
    P->>API: GET /room/:roomId/access
    API->>DB: Validate appointment window + membership
    API-->>D: canJoinNow + appointment
    API-->>P: canJoinNow + appointment

    D->>API: POST /room/:roomId/signal (peer-joined/call-started)
    P->>API: GET /room/:roomId/signals (poll)
    API->>DB: Persist + fetch ConsultationSignal
    API-->>P: new signals

    D->>WS: webrtc-offer + ICE
    WS-->>P: webrtc-offer + ICE
    P->>WS: webrtc-answer + ICE
    WS-->>D: webrtc-answer + ICE

    Note over D,P: Peer connection established, media streams exchanged
```

## 8) Appointment Lifecycle State Diagram

```mermaid
stateDiagram-v2
    [*] --> SLOT_AVAILABLE
    SLOT_AVAILABLE --> PAYMENT_CREATED: create payment order
    PAYMENT_CREATED --> SLOT_BOOKED: payment verified + lock slot
    SLOT_AVAILABLE --> SLOT_BOOKED: free booking path (fee=0 or payment disabled)
    SLOT_BOOKED --> APPOINTMENT_CONFIRMED: appointment created
    APPOINTMENT_CONFIRMED --> IN_PROGRESS: doctor starts consultation
    IN_PROGRESS --> COMPLETED: consultation closed
    APPOINTMENT_CONFIRMED --> CANCELLED: cancelled by doctor/patient/admin
    APPOINTMENT_CONFIRMED --> NO_SHOW: no participant
    PAYMENT_CREATED --> PAYMENT_EXPIRED: TTL / timeout
    PAYMENT_CREATED --> PAYMENT_FAILED: signature fail
```

## 9) Frontend Route and Access Diagram

```mermaid
flowchart LR
    Public["Public Routes\n/ /login /verify-otp /forgot-password /about /knowledge"]
    Patient["Patient Protected\n/symptoms /results /dashboard /doctors /doctors/:id"]
    Doctor["Doctor Protected\n/doctor-dashboard"]
    Admin["Admin Protected\n/admin-dashboard /services"]
    Shared["Shared Protected\n/consultation/:roomId (patient/doctor/admin)"]

    AuthCtx["AuthContext\naccess_token + refresh_token + ayur_user\npending OTP session"]
    PR["ProtectedRoute\nrole gate"]

    Public --> AuthCtx
    Patient --> PR
    Doctor --> PR
    Admin --> PR
    Shared --> PR
    PR --> AuthCtx
```

## 10) Deployment Diagram (Vercel-Based)

```mermaid
flowchart TB
    subgraph UserSide["End Users"]
      U1["Patients"]
      U2["Doctors"]
      U3["Admins"]
      U4["Pharmacies"]
    end

    subgraph VercelFrontend["Vercel Project: Frontend"]
      F1["Static React Build\n(Rewrite all paths -> index.html)"]
    end

    subgraph VercelBackend["Vercel Project: Backend"]
      B1["Serverless Function api/index.js\nBootstraps Express app"]
      B2["Express Routes + Middleware"]
    end

    subgraph DataLayer["Managed Data"]
      M1["MongoDB Atlas"]
    end

    subgraph ThirdParty["Third-party Integrations"]
      T1["Razorpay Orders + Verify"]
      T2["Google OAuth tokeninfo"]
      T3["SMTP Provider"]
      T4["OpenAI API (optional)"]
    end

    U1 --> F1
    U2 --> F1
    U3 --> F1
    U4 --> F1

    F1 -->|HTTPS REST| B1
    B1 --> B2
    B2 --> M1
    B2 --> T1
    B2 --> T2
    B2 --> T3
    B2 --> T4
```

## 11) API Domain Map

```mermaid
mindmap
  root((AyuSetu API))
    Auth
      signup/login/google-login
      verify-otp/resend-otp
      refresh-token/logout/me
      forgot-password
    Symptoms
      submit
      history
      details
    Doctors
      list/details/specialties
      profile update
      availability upsert/read
    Appointments
      book
      payment order/verify
      room access/signals
      status/start/remind
      case-summary
    Prescriptions
      create/mine
      by appointment
      qr lookup
    Therapy
      create/mine
      session update
    Pharmacy
      inventory
      search
    Chats
      create/mine/memory
      patient message
      doctor message
      assign doctor
      prescription analyze
    Admin
      pending doctors
      verify doctor
      overview
      system-health
    Analytics
      trends
      district trends
      dashboard
```
