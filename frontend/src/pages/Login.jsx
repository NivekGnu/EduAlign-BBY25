/**
 * @fileoverview Login Page
 * 
 * Authentication page for users to sign in with email and password.
 * Redirects to appropriate dashboard based on user role.
 */

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase/firebase";
import "../styles/login.css";

/**
 * Login - User authentication page
 * 
 * Handles user sign-in and redirects to applicant or reviewer dashboard
 * based on Firebase custom claims role.
 */
export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ type: "", message: "" }); // type: "error" | "success"

  const alertClass = useMemo(() => {
    if (!alert.message) return "alert";
    return alert.type === "error" ? "alert alert-error" : "alert alert-success";
  }, [alert]);

  /**
   * Handle login form submission
   * 
   * Authenticates user with Firebase and redirects to appropriate dashboard
   * based on role (reviewer or applicant).
   * 
   * @async
   * @param {Event} e - Form submit event
   */
  async function handleSubmit(e) {
    e.preventDefault();
    setAlert({ type: "", message: "" });
    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);

      // Equivalent to: user.getIdTokenResult()
      const tokenResult = await cred.user.getIdTokenResult(true);
      const role = tokenResult?.claims?.role || "applicant";

      if (role === "reviewer") {
        navigate("/reviewer");
      } else {
        navigate("/applicant");
      }
    } catch (err) {
      console.log("Firebase projectId:", auth.app.options.projectId);
  console.log("Auth error:", err.code, err.message);

  setAlert({ type: "error", message: `${err.code}: ${err.message}` });
  setLoading(false);
    }
  }

  return (
    <div className="wsbc-page_login-page">
      <div className="main-container_login-page">
        <img
          src="https://ux-static.online.worksafebc.com/css/assets/img/worksafebc-logo.jpg"
          alt="WorkSafeBC"
          className="logo"
        />

        {alert.message ? <div className={alertClass}>{alert.message}</div> : null}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              className="form-control"
              id="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              className="form-control"
              id="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-blue btn-block btn-lg"
            disabled={loading}
          >
            {loading ? (
              <>
                <i className="fa fa-spinner fa-spin" /> Logging in...
              </>
            ) : (
              <>
                <i className="fa fa-sign-in" /> Login
              </>
            )}
          </button>
        </form>

        <div className="login-links">
          <p>
            Don&apos;t have an account? <Link to="/signup">Sign up</Link>
          </p>
          <p>
            <Link to="/">Go Back</Link>
          </p>
        </div>
      </div>
    </div>
  );
}