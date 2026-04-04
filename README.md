# EduAlign AI

EduAlign AI is a **submission and review platform** for **asbestos abatement training providers** seeking WorkSafeBC approval for **Level 1: Foundational Awareness** programs.

The platform uses AI-powered curriculum analysis to streamline the approval process by:
- Automatically mapping course materials to WorkSafeBC competency frameworks
- Generating pre-filled curriculum mapping templates
- Enabling structured review workflows for approval officers
- Reducing back-and-forth between reviewers and applicants

---

## Platform Overview

EduAlign AI bridges the gap between training providers and WorkSafeBC reviewers by:

1. **For Training Providers:**
   - Upload curriculum PDFs and get instant AI analysis
   - Receive pre-filled Excel templates mapped to Level 1 competencies
   - Submit complete applications with version control
   - Track application status in real-time

2. **For Reviewers:**
   - View all submitted applications with dashboard statistics
   - Access curriculum files, package documents, and AI-generated mappings
   - Update application status (Unreviewed → Incomplete → Approved)
   - Review version history for revised applications

3. **Key Benefits:**
   - Reduces manual competency mapping time
   - Improves accuracy of competency alignment
   - Creates traceable validation records
   - Standardizes the approval workflow

---

## Tech Stack

### **Backend**
- **Node.js + Express** - REST API server
- **Firebase Admin SDK** - Authentication, Firestore database, Cloud Storage
- **Groq API** - AI curriculum analysis (llama-3.3-70b-versatile)
- **ExcelJS** - Excel template generation
- **pdf-parse** - PDF text extraction
- **Multer** - File upload handling

### **Frontend**
- **React + Vite** - UI framework and build tool
- **React Router** - Client-side routing
- **Firebase SDK** - Client-side authentication
- **Axios** - HTTP requests

### **Infrastructure**
- **Firebase Firestore** - NoSQL database for application records
- **Firebase Storage** - File storage for PDFs and Excel files
- **Firebase Authentication** - User management with custom claims (applicant/reviewer roles)

---

## Project Structure

```
edualign-ai/
├── backend/
│   ├── controllers/           # Request handlers
│   │   ├── applicationController.js
│   │   ├── authController.js
│   │   └── reviewerController.js
│   ├── middleware/            # Auth middleware
│   │   └── auth.js
│   ├── routes/                # API route definitions
│   │   ├── applications.js
│   │   ├── auth.js
│   │   └── reviewer.js
│   ├── utils/                 # Utility functions
│   │   ├── excelFiller.js     # Excel template generation
│   │   ├── firebase.js        # Firebase Admin initialization
│   │   ├── firebaseStorage.js # Cloud Storage wrapper
│   │   ├── firestoreService.js # Database operations
│   │   ├── groqAnalyzer.js    # AI curriculum analysis
│   │   ├── pdfParser.js       # PDF text extraction
│   │   └── manageRole.js      # CLI role management
│   ├── templates/             # Excel template files
│   ├── firebase-config.js     # Client-side Firebase config
│   ├── server.js              # Express server entry point
│   ├── .env                   # Environment variables
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── pages/             # Page components
│   │   ├── App.jsx            # Root component
│   │   └── main.jsx           # Entry point
│   ├── package.json
│   └── vite.config.js
└── README.md
```

---

## Getting Started

### **Prerequisites**
- Node.js (v16 or higher)
- npm or yarn
- Firebase project with Firestore, Storage, and Authentication enabled
- Groq API key (free tier available)

### **1. Clone Repository**
```bash
git clone <repository-url>
cd edualign-ai
```

### **2. Backend Setup**

```bash
# Install dependencies
npm install

# Create .env file with the following variables:
# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=your-bucket-name

# Groq API
GROQ_API_KEY=your-groq-api-key

# Server config
PORT=3000
MAX_FILE_SIZE_MB=10

# Start server
node server.js
```

Server runs at: `http://localhost:3000`

### **3. Frontend Setup**

```bash
# Navigate to frontend folder
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs at: `http://localhost:5173`

### **4. Set Up First Reviewer**

```bash
# Promote a user to reviewer role (run from backend folder)
node utils/manageRole.js user@example.com
```

---

## API Endpoints

### **Authentication**
- `POST /api/auth/set-role` - Set user role to "applicant" (default)

### **Applicant Routes** (requires authentication)
- `POST /api/applications/analyze` - Preview curriculum analysis (no save)
- `POST /api/applications/submit` - Submit new application
- `POST /api/applications/revise/:id` - Add revision to existing application
- `GET /api/applications/my-applications` - Get user's applications
- `GET /api/applications/my-applications/:id` - Get application details

### **Reviewer Routes** (requires reviewer role)
- `GET /api/reviewer/applications` - Get all applications with stats
- `GET /api/reviewer/applications/:id` - Get application details
- `PATCH /api/reviewer/applications/:id/status` - Update application status

### **Utility**
- `GET /api/health` - Health check endpoint

---

## Application Workflow

### **1. Applicant Submits Application**
```
Upload PDFs → AI Analysis → Generate Excel → Create Application (v1)
```

**Files required:**
- **Curriculum PDFs** (1-10 files): Course materials to be analyzed
- **Package Files** (exactly 3 PDFs):
  - Provider Application Form
  - Course Outline
  - Administrative Documentation

### **2. AI Analysis**
- Extracts text from all curriculum PDFs
- Maps content to 33 Level 1 competencies
- Identifies:
  - **Where** each competency is covered (document + page numbers)
  - **How taught** (In-class presentation, online materials, etc.)
  - **How assessed** (Quiz, practical observation, etc.)
- Generates missing criteria list

### **3. Excel Template Generation**
- Fills WorkSafeBC template with AI mappings
- Marks missing competencies as "Not covered"
- Uploads to Firebase Storage

### **4. Review Process**
- Reviewer views application with all files
- Updates status:
  - **Unreviewed** → Initial state
  - **Incomplete** → Missing competencies, needs revision
  - **Approved** → All competencies covered

### **5. Revision (if needed)**
- Applicant uploads revised curriculum
- New version created (preserves history)
- AI re-analyzes and generates new Excel

---

## Database Schema

### **Applications Collection**
```javascript
{
  id: "auto-generated-firestore-id",
  applicationId: "APP20250403ABCD",  // Human-readable ID
  userId: "firebase-uid",
  providerName: "John Doe",
  organizationName: "ABC Training Inc",
  email: "provider@example.com",
  status: "Unreviewed" | "Incomplete" | "Approved",
  submittedDate: Date,
  currentVersion: 2,  // Latest version number
  versions: [
    {
      version: 1,
      analyzedAt: Date,
      curriculumFiles: [...],  // Array of file metadata
      applicationPackageFiles: [...],
      excelFile: {...},
      mappings: [...],  // AI-found competencies
      missingCriteria: [...]  // Not covered
    },
    {
      version: 2,
      // ... (revision data)
    }
  ],
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

## Authentication & Authorization

### **Roles**
- **applicant** (default) - Can submit and revise own applications
- **reviewer** - Can view all applications and update status

### **Firebase Custom Claims**
Roles stored in Firebase Auth custom claims:
```javascript
{
  uid: "user-id",
  email: "user@example.com",
  role: "applicant" | "reviewer"
}
```

### **Middleware**
- `requireAuth` - Verifies Firebase ID token
- `requireReviewerRole` - Ensures user has reviewer role

---

## Key Features

### **AI Curriculum Analysis**
- **Model:** Groq llama-3.3-70b-versatile
- **Token limit:** 8000 max tokens
- **Temperature:** 0.0 (deterministic)
- **Output:** JSON with mappings and missing criteria

### **Version Control**
- Each application maintains complete version history
- Revisions create new versions without deleting old ones
- All files preserved for audit trail

### **File Storage Structure**
```
applications/
  └── {applicationId}/
      ├── {timestamp}_curriculum1.pdf
      ├── {timestamp}_curriculum2.pdf
      ├── {timestamp}_provider_form.pdf
      ├── {timestamp}_course_outline.pdf
      ├── {timestamp}_admin_docs.pdf
      └── {timestamp}_Filled_Level1_{applicationId}.xlsx
```

### **Signed URLs**
- Generated for secure file access
- Valid for 1 day (configurable)
- Automatically regenerated when expired

---

## Testing

### **Test Error Handling**
```bash
curl http://localhost:3000/test-500
# Should return 500 error
```

### **Test Health Check**
```bash
curl http://localhost:3000/api/health
# Returns: {"success":true,"message":"API is running"}
```

---

## 🔧 Configuration

### **Rate Limiting**
- 60 requests per hour per IP address
- Configurable in `server.js`

### **File Upload Limits**
- Max file size: 10MB (default, configurable via `MAX_FILE_SIZE_MB`)
- Max curriculum PDFs: 10
- Required package files: 3
- Body size limit: 15MB

### **AI Analysis Limits**
- Curriculum text truncated to 10,000 characters (Groq free tier)
- Increase in production for full analysis

---

## Environment Variables

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
MAX_FILE_SIZE_MB=10
```

---

## Common Issues

### **Firebase initialization fails**
- Verify all Firebase env variables are set
- Check private key formatting (must include `\n` newlines)
- Ensure service account has correct permissions

### **PDF parsing fails**
- Only text-based PDFs supported (not scanned images)
- Files must be valid PDFs with >100 characters
- Use OCR for scanned documents

### **Groq API errors**
- Free tier: 100k tokens/day limit
- Check API key validity
- Monitor rate limits

---

## License

Copyright (c) 2025 WorkSafeBC. All rights reserved.

This project is a student-sponsored initiative developed for WorkSafeBC.
Unauthorized copying, modification, or distribution is prohibited.

---

## 👥 Authors
- Clinton Nguyen, Kevin Ung, Shawn Lee, Tommy Tang

---

## Acknowledgments
- WorkSafeBC for competency framework and CSS
- Groq for AI infrastructure
- Firebase for backend services