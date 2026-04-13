# EduAlign AI

EduAlign AI is a **submission and review platform** for **asbestos abatement training providers** seeking WorkSafeBC approval for **Level 1: Foundational Awareness** programs.

The platform uses AI-powered curriculum analysis to streamline the approval process by:
- Automatically mapping course materials to WorkSafeBC competency frameworks
- Generating pre-filled curriculum mapping templates
- Enabling structured review workflows for approval officers
- Reducing back-and-forth between reviewers and applicants

---

## Tech Stack

**Backend:** Node.js, Express, Firebase Admin SDK, Groq API, ExcelJS, pdf-parse, Multer  
**Frontend:** React, Vite, React Router, Firebase SDK  
**Infrastructure:** Firebase (Firestore, Storage, Authentication)

---

## Project Structure

```
EDUALIGN-BBY25/
├── backend/
│   ├── config/constants.js         # Configuration constants
│   ├── controllers/                # Request handlers
│   ├── middleware/auth.js          # Authentication middleware
│   ├── routes/                     # API route definitions
│   ├── utils/                      # Firebase, Groq, PDF, Excel utilities
│   ├── templates/                  # Excel template file
│   ├── uploads/                    # Temporary file storage
│   ├── server.js
│   └── .env                        # Environment variables
└── frontend/
    ├── src/
    │   ├── config/constants.js     # Frontend configuration
    │   ├── firebase/firebase.js    # Firebase client config
    │   ├── pages/                  # React page components
    │   ├── styles/                 # CSS files
    │   ├── App.jsx
    │   └── main.jsx
    ├── index.html
    └── vite.config.js
```

---

## Configuration

### **Backend** (`backend/config/constants.js`)
```javascript
MAX_FILE_SIZE_MB = 10              // Maximum file size (10MB)
MAX_CURRICULUM_FILES = 10          // Maximum curriculum PDFs (1-10)
APPLICATION_PACKAGE_FILES = 3      // Required package files (exactly 3)
MAX_INPUT_CHARACTERS = 10000       // AI input limit (10k chars, increase for production eg. 100k)
MAX_RESPONSE_TOKENS = 5000        // AI response limit 
```

### **Frontend** (`frontend/src/config/constants.js`)
```javascript
API_BASE_URL                       // Backend API URL (defaults to http://localhost:3000)
MAX_FILE_SIZE_MB = 10              // Maximum file size
MAX_CURRICULUM_FILES = 10          // Maximum curriculum PDFs
REQUIRED_PACKAGE_FILES = 3         // Required package files
```

### **Environment Variables** (`backend/.env`)
```env
# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=your-project.appspot.com

# Groq API
GROQ_API_KEY=gsk_...

# Server
PORT=3000
```

**Note:** Frontend has no `.env` file. API URL configurable via `VITE_API_BASE_URL` environment variable if needed.

---

## Getting Started

### **Prerequisites**
- Node.js (v16+)
- Firebase project with Firestore, Storage, and Authentication enabled
- Groq API key (free tier available at https://console.groq.com)

### **Installation**

**1. Clone and install:**
```bash
git clone <repository-url>
cd EDUALIGN-BBY25

# Backend
cd backend
npm install

# Frontend (in new terminal)
cd frontend
npm install
```

**2. Configure backend:**
Create `backend/.env` with Firebase and Groq credentials (see Configuration section above)

**3. Start servers:**
```bash
# Backend (port 3000)
cd backend
node server.js

# Frontend (port 5173)
cd frontend
npm run dev
```

**4. Set up first reviewer:**
```bash
cd backend
node utils/manageRole.js user@example.com
```

---

## Application Workflow

**1. Submit Application**  
Applicant uploads curriculum PDFs (1-10) + 3 package files (Provider Form, Course Outline, Administration Document)

**2. AI Analysis**  
Groq AI maps curriculum to 26 Level 1 competencies, identifies where/how taught/assessed

**3. Generate Excel**  
Pre-filled WorkSafeBC template with mappings + missing competencies marked "Not covered"

**4. Review**  
Reviewer updates status: Unreviewed → Incomplete (if revisions needed) → Approved

**5. Revision** (if needed)  
Applicant uploads revised curriculum, creates new version (preserves history)

---

## API Endpoints

### **Authentication**
- `POST /api/auth/set-role` - Set user role (default: applicant)

### **Applicant** (requires authentication)
- `POST /api/applications/analyze` - Preview analysis (no save)
- `POST /api/applications/submit` - Submit new application
- `POST /api/applications/revise/:id` - Add revision
- `GET /api/applications/my-applications` - Get user's applications
- `GET /api/applications/my-applications/:id` - Get application details

### **Reviewer** (requires reviewer role)
- `GET /api/reviewer/applications` - Get all applications + stats
- `GET /api/reviewer/applications/:id` - Get application details
- `PATCH /api/reviewer/applications/:id/status` - Update status

### **Utility**
- `GET /api/health` - Health check

---

## Key Features

### **AI Analysis**
- **Model:** Groq llama-3.3-70b-versatile
- **Input:** 10,000 characters (configurable, increase for production)
- **Output:** JSON with competency mappings + missing criteria
- **Temperature:** 0.0 (deterministic)

### **Authentication**
- **Roles:** applicant (default), reviewer
- **Method:** Firebase custom claims
- **Middleware:** `requireAuth`, `requireReviewerRole`

### **File Storage**
- **Structure:** `applications/{applicationId}/{timestamp}_{filename}`
- **Access:** Signed URLs (valid 1 day, regenerated as needed)
- **Limits:** 10MB per file, 15MB request body, 60 requests/hour per IP

### **Version Control**
- Complete version history preserved
- All files saved for audit trail
- Revisions create new versions without deleting old ones

---

## Database Schema

```javascript
{
  applicationId: "APP20250403ABCD",       // Human-readable ID
  userId: "firebase-uid",
  providerName: "John Doe",
  organizationName: "ABC Training Inc",
  email: "provider@example.com",
  status: "Unreviewed" | "Incomplete" | "Approved",
  submittedDate: Date,
  currentVersion: 2,
  versions: [
    {
      version: 1,
      analyzedAt: Date,
      curriculumFiles: [...],           // File metadata
      applicationPackageFiles: [...],
      excelFile: {...},
      mappings: [...],                  // AI-found competencies
      missingCriteria: [...]            // Not covered
    }
  ],
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## Production Deployment

1. Upgrade to paid Groq plan
2. Increase `MAX_INPUT_CHARACTERS` to 50000-100000
3. Increase `MAX_RESPONSE_TOKENS` to 25000-50000
4. Configure CORS for production domain
5. Set `VITE_API_BASE_URL` to production API URL

---

## License

Copyright (c) 2025 WorkSafeBC. All rights reserved.

This project is a student-sponsored initiative developed for WorkSafeBC.  
Unauthorized copying, modification, or distribution is prohibited.

**Authors:** Clinton Nguyen, Kevin Ung, Shawn Lee, Tommy Tang

**Acknowledgments:** WorkSafeBC, Groq, Firebase