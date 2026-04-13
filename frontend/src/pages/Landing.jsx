/**
 * @fileoverview Landing Page
 * 
 * Public landing page with login/signup options for training providers
 * and WorkSafeBC reviewers.
 */

import { Link } from "react-router-dom";
import "../styles/landing.css";

/**
 * Landing - Public landing page
 * 
 * Entry point for unauthenticated users with options to login or sign up.
 */
export default function Landing() {
  return (
    <div className="wsbc-page_landing-page">
      <div className="main-container_landing-page">
        <img
          src="https://ux-static.online.worksafebc.com/css/assets/img/worksafebc-logo.jpg"
          alt="WorkSafeBC"
          className="logo_landing-page"
        />

        <h1>Asbestos Abatement Training Provider Application System</h1>

        <p className="subtitle">
          Submit and review training curricula for WorkSafeBC approval.
          <br />
          Training provider applicants can submit applications and track their
          status.
          <br />
          WorkSafeBC reviewers can review and approve applications.
        </p>

        <div className="btn-group">
          <Link to="/login" className="btn btn-blue btn-lg">
            <i className="fa fa-sign-in" /> Login
          </Link>

          <Link to="/signup" className="btn btn-outline-blue btn-lg">
            <i className="fa fa-user-plus" /> Sign Up
          </Link>
        </div>

        <div className="note">
          <i className="fa fa-info-circle" /> WorkSafeBC reviewers: Use your
          @worksafebc.com email
        </div>
      </div>
    </div>
  );
}