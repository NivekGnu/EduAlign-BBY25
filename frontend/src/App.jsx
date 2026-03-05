import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import ApplicantIndex from "./pages/ApplicantIndex.jsx";
import ReviewerIndex from "./pages/ReviewerIndex.jsx";
import Application from "./pages/Application.jsx";
import NotFound from "./pages/NotFound.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Dashboards */}
        <Route path="/applicant" element={<ApplicantIndex />} />
        <Route path="/reviewer" element={<ReviewerIndex />} />

        {/* Application detail/form */}
        <Route path="/application" element={<Application />} />

        {/* Backwards compatibility (if anyone bookmarks old paths) */}
        <Route path="/landing.html" element={<Navigate to="/" replace />} />
        <Route path="/login.html" element={<Navigate to="/login" replace />} />
        <Route path="/signup.html" element={<Navigate to="/signup" replace />} />
        <Route path="/applicant-index.html" element={<Navigate to="/applicant" replace />} />
        <Route path="/reviewer-index.html" element={<Navigate to="/reviewer" replace />} />
        <Route path="/application.html" element={<Navigate to="/application" replace />} />
        <Route path="/error.html" element={<Navigate to="/error" replace />} />

        {/* Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}