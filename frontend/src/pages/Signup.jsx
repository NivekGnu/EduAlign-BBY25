import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "../firebase/firebase"; // adjust if your path is different
import { API_BASE_URL } from "../../config/constants";
import "../styles/signup.css";

export default function Signup() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      // 1) Create Firebase user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      const user = userCredential.user;

      // 2) Update display name
      await updateProfile(user, { displayName: name });

      // 3) Call backend to set role (custom claims)
      const roleResponse = await fetch(`${API_BASE_URL}/api/auth/set-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid }),
      });

      const roleResult = await roleResponse.json();

      if (!roleResponse.ok || !roleResult.success) {
        throw new Error(roleResult.error || "Failed to set user role");
      }

      // 4) Force token refresh to get new claims
      await user.getIdToken(true);

      // 5) Read claims
      const tokenResult = await user.getIdTokenResult();
      const role = tokenResult.claims.role || "applicant";

      // 6) Redirect based on role
      if (role === "reviewer") {
        navigate("/reviewer");
      } else {
        navigate("/applicant");
      }
    } catch (err) {
      setError(err.message || "Signup failed");
      setLoading(false);
    }
  }

  return (
    <div className="wsbc-page_signup">
      <div className="main-container_signup">
        <img
          src="https://ux-static.online.worksafebc.com/css/assets/img/worksafebc-logo.jpg"
          alt="WorkSafeBC"
          className="logo_signup"
        />

        <h1>Create Account</h1>

        {error && (
          <div className="alert_signup alert-error_signup">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">
              Your Name <span className="text-danger">*</span>
            </label>
            <input
              id="name"
              type="text"
              className="form-control"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">
              Email <span className="text-danger">*</span>
            </label>
            <input
              id="email"
              type="email"
              className="form-control"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <small className="text-muted">
              Reviewer: Use your @worksafebc.com email
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="password">
              Password <span className="text-danger">*</span>
            </label>
            <input
              id="password"
              type="password"
              className="form-control"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <small className="text-muted">Minimum 6 characters</small>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">
              Confirm Password <span className="text-danger">*</span>
            </label>
            <input
              id="confirmPassword"
              type="password"
              className="form-control"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-blue btn-block btn-lg"
            disabled={loading}
          >
            {loading ? (
              <>
                <i className="fa fa-spinner fa-spin" /> Creating...
              </>
            ) : (
              <>
                <i className="fa fa-user-plus" /> Create Account
              </>
            )}
          </button>
        </form>

        <div className="signup-links">
          <p>
            Already have an account? <Link to="/login">Login</Link>
          </p>
          <p>
            <Link to="/">Go Back</Link>
          </p>
        </div>
      </div>
    </div>
  );
}