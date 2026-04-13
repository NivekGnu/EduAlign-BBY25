/**
 * @fileoverview 404 Not Found Page
 * 
 * Error page displayed for invalid routes or unauthorized access attempts.
 * Provides navigation options based on user authentication state.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/firebase";
import "../styles/notfound.css";

/**
 * NotFound - 404 error page
 * 
 * Displays customizable error messages based on URL parameters and provides
 * navigation options that adapt to user's authentication state and role.
 */
export default function NotFound() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [title, setTitle] = useState("Page not found");
  const [message, setMessage] = useState(
    "The page you’re looking for doesn’t exist, or the link is no longer available."
  );

  const [homePath, setHomePath] = useState("/"); // default for logged-out users

  // Decide where "Home" goes based on auth + role
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setHomePath("/");
        return;
      }

      try {
        const tokenResult = await user.getIdTokenResult(true);
        const role = tokenResult?.claims?.role || "applicant";
        setHomePath(role === "reviewer" ? "/reviewer" : "/applicant");
      } catch {
        setHomePath("/");
      }
    });

    return () => unsub();
  }, []);

  // Set title/message from query params
  useEffect(() => {
    const code = searchParams.get("code");
    const msg = searchParams.get("msg");

    if (code === "500") {
      document.title = "WorkSafeBC - Server Error";
      setTitle("Something went wrong");
      setMessage(msg || "An unexpected server error occurred. Please try again.");
    } else if (code === "403") {
      document.title = "WorkSafeBC - Access Denied";
      setTitle("Access denied");
      setMessage(msg || "You do not have permission to view this page.");
    } else {
      document.title = "WorkSafeBC - Page Not Found";
    }
  }, [searchParams]);

  return (
    <div className="wsbc-page_notfound">
      <div className="main-container_notfound">
        <img
          src="https://ux-static.online.worksafebc.com/css/assets/img/worksafebc-logo.jpg"
          alt="WorkSafeBC"
          className="logo"
        />

        <h1>{title}</h1>
        <p className="subtitle">{message}</p>

        <div className="actions">
          <Link to={homePath} className="btn btn-blue btn-lg">
            <i className="fa fa-home"></i> Go to Home
          </Link>

          <button className="btn btn-outline-blue btn-lg" onClick={() => navigate(-1)}>
            <i className="fa fa-arrow-left"></i> Go Back
          </button>
        </div>

        <div className="note">
          <i className="fa fa-info-circle"></i>
          If you believe this is an error, try refreshing the page or returning to Home.
        </div>
      </div>
    </div>
  );
}