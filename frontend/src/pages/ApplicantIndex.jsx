/**
 * @fileoverview Applicant Dashboard
 * 
 * Main dashboard for training provider applicants showing application statistics,
 * list of submitted applications, and modal for viewing application details.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { API_BASE_URL } from "../config/constants";
import "../styles/applicantindex.css";

/**
 * Format Firestore timestamp to readable date string
 * 
 * @param {Object|Date} ts - Firestore timestamp with _seconds or JS Date
 * @returns {string} Formatted date (e.g., "Jan 15, 2025") or "—" if invalid
 */
function formatDate(ts) {
  if (!ts) return "—";
  const date = ts._seconds ? new Date(ts._seconds * 1000) : new Date(ts);
  return isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

/**
 * ApplicantIndex - Dashboard for training provider applicants
 * 
 * Displays application statistics, list of submitted applications with view/revise
 * actions, and modal dialog for viewing detailed application information including
 * version history, files, and competency mappings.
 */
export default function ApplicantIndex() {
  const navigate = useNavigate();

  const [authToken, setAuthToken] = useState(null);
  const [userInfo, setUserInfo] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [applications, setApplications] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalData, setModalData] = useState(null);

  const [expandedVersions, setExpandedVersions] = useState({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/", { replace: true });
        return;
      }

      try {
        const tokenResult = await user.getIdTokenResult(true);
        const role = tokenResult?.claims?.role || "applicant";

        if (role === "reviewer") {
          navigate("/", { replace: true });
          return;
        }

        const token = await user.getIdToken();
        setAuthToken(token);
        setUserInfo({
          email: user.email,
          displayName: user.displayName,
        });
      } catch (err) {
        console.error(err);
        navigate("/", { replace: true });
      }
    });

    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    if (!authToken) return;
    loadMyApplications();
  }, [authToken]);

  /**
   * Fetch all applications for authenticated user
   * 
   * @async
   * @throws {Error} If API request fails
   */
  async function loadMyApplications() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/applications/my-applications`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || `Failed to load (${response.status})`);
      }

      setApplications(result.applications || []);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to load applications.");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Sign out user and redirect to landing page
   */
  async function handleLogout() {
    await signOut(auth);
    navigate("/", { replace: true });
  }

  /**
   * View application details in modal with version history
   * 
   * @async
   * @param {string} id - Application Firestore document ID
   */
  async function viewApplication(id) {
    setModalOpen(true);
    setModalLoading(true);
    setModalError("");
    setModalData(null);
    setExpandedVersions({});

    try {
      const response = await fetch(`${API_BASE_URL}/api/applications/my-applications/${id}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || `Failed to load application (${response.status})`);
      }

      const app = result.application;
      const versions = result.versions || [];

      const initialExpanded = {};
      versions.forEach((v) => {
        if (v.version === app.currentVersion) {
          initialExpanded[v.version] = true;
        }
      });

      setExpandedVersions(initialExpanded);
      setModalData({
        application: app,
        versions,
      });
    } catch (err) {
      console.error(err);
      setModalError(err?.message || "Failed to load application details.");
    } finally {
      setModalLoading(false);
    }
  }

  /**
   * Toggle expansion state of version accordion
   * 
   * @param {number} versionNumber - Version number to toggle
   */
  function toggleVersion(versionNumber) {
    setExpandedVersions((prev) => ({
      ...prev,
      [versionNumber]: !prev[versionNumber],
    }));
  }

  const stats = useMemo(() => {
    return {
      total: applications.length,
      unreviewed: applications.filter((a) => a.status === "Unreviewed").length,
      incomplete: applications.filter((a) => a.status === "Incomplete").length,
      approved: applications.filter((a) => a.status === "Approved").length,
    };
  }, [applications]);

  return (
    <div className="wsbc-page_applicantindex">
      <div className="main-container_applicantindex">
        <div className="header-bar_applicantindex">
          <div>
            <img
              src="https://ux-static.online.worksafebc.com/css/assets/img/worksafebc-logo.jpg"
              alt="WorkSafeBC"
              className="logo_applicantindex"
            />
            <h1>My Applications</h1>
            <p className="text-muted">
              {userInfo
                ? `Welcome, ${userInfo.displayName || userInfo.email}!`
                : "Loading..."}
            </p>
          </div>

          <div>
            <button className="btn btn-outline-grey" onClick={handleLogout}>
              <i className="fa fa-sign-out" /> Logout
            </button>
          </div>
        </div>

        <div className="stats-row_applicantindex">
          <div className="stat-card_applicantindex stat-unreviewed_applicantindex">
            <h3>{stats.unreviewed}</h3>
            <p>Unreviewed</p>
          </div>

          <div className="stat-card_applicantindex stat-incomplete_applicantindex">
            <h3>{stats.incomplete}</h3>
            <p>Incomplete</p>
          </div>

          <div className="stat-card_applicantindex stat-approved_applicantindex">
            <h3>{stats.approved}</h3>
            <p>Approved</p>
          </div>

          <div className="stat-card_applicantindex stat-total_applicantindex">
            <h3>{stats.total}</h3>
            <p>Total Applications</p>
          </div>
        </div>

        <div className="mb-4">
          <Link to="/application" className="btn btn-orange">
            <i className="fa fa-plus" /> Submit New Application
          </Link>
        </div>

        <div className="table-responsive">
          <table className="table table-striped">
            <thead>
              <tr>
                <th>Application ID</th>
                <th>Provider</th>
                <th>Organization</th>
                <th>Email</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center">
                    <i className="fa fa-spinner fa-spin" /> Loading...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="7" className="text-center text-danger">
                    Error: {error}
                  </td>
                </tr>
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center">
                    No applications yet. <Link to="/application">Submit your first application</Link>
                  </td>
                </tr>
              ) : (
                applications.map((app) => {
                  const statusClass = `status-${app.status.toLowerCase()}_applicantindex`;

                  return (
                    <tr key={app._id}>
                      <td>
                        <strong>{app.applicationId}</strong>
                      </td>
                      <td>{app.providerName}</td>
                      <td>{app.organizationName}</td>
                      <td>{app.email}</td>
                      <td>{formatDate(app.submittedDate)}</td>
                      <td>
                        <span className={`status-badge_applicantindex ${statusClass}`}>
                          {app.status}
                        </span>
                      </td>
                      <td className="actions-cell_applicantindex">
                        <button
                          className="btn btn-sm btn-blue"
                          onClick={() => viewApplication(app._id)}
                        >
                          <i className="fa fa-eye" /> View
                        </button>

                        {app.status === "Incomplete" ? (
                          <button
                            className="btn btn-sm btn-orange"
                            onClick={() =>
                              navigate(`/application-revise?id=${app._id}`)
                            }
                          >
                            <i className="fa fa-upload" /> Revise
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen ? (
        <div
          className="modal-overlay_applicantindex"
          onMouseDown={() => setModalOpen(false)}
        >
          <div
            className="modal-box_applicantindex"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-header_applicantindex">
              <h5 className="modal-title_applicantindex">Application Details</h5>
              <button
                className="modal-close_applicantindex"
                onClick={() => setModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <div className="modal-body_applicantindex">
              {modalLoading ? (
                <p className="text-center">
                  <i className="fa fa-spinner fa-spin" /> Loading...
                </p>
              ) : modalError ? (
                <p className="text-danger">{modalError}</p>
              ) : modalData ? (
                <ApplicantModalContent
                  data={modalData}
                  expandedVersions={expandedVersions}
                  toggleVersion={toggleVersion}
                />
              ) : null}
            </div>

            <div className="modal-footer_applicantindex">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Modal content for displaying application details
 * 
 * @param {Object} props
 * @param {Object} props.data - Application and versions data
 * @param {Object} props.expandedVersions - Version expansion state
 * @param {Function} props.toggleVersion - Toggle version expansion
 */
function ApplicantModalContent({ data, expandedVersions, toggleVersion }) {
  const app = data.application;
  const versions = [...(data.versions || [])].sort((a, b) => b.version - a.version);

  return (
    <div>
      <h4>
        {app.applicationId} - {app.providerName}
      </h4>
      <p>
        <strong>Organization:</strong> {app.organizationName}
      </p>
      <p>
        <strong>Email:</strong> {app.email}
      </p>
      <p>
        <strong>Status:</strong> {app.status}
      </p>
      <p>
        <strong>Submitted:</strong> {formatDate(app.submittedDate)}
      </p>
      {app.reviewedDate ? (
        <p>
          <strong>Reviewed:</strong> {formatDate(app.reviewedDate)}
        </p>
      ) : null}
      {app.lastRevised ? (
        <p>
          <strong>Last Revised:</strong> {formatDate(app.lastRevised)}
        </p>
      ) : null}

      <hr />
      <h5>Version History</h5>

      {versions.length === 0 ? (
        <p className="text-muted">No versions available</p>
      ) : (
        <div className="accordion_applicantindex">
          {versions.map((v) => {
            const isCurrentVersion = v.version === app.currentVersion;
            const isExpanded = !!expandedVersions[v.version];

            return (
              <div className="card_applicantindex" key={v.version}>
                <div className="card-header_applicantindex">
                  <button
                    className="btn-link_applicantindex"
                    type="button"
                    onClick={() => toggleVersion(v.version)}
                  >
                    {isExpanded ? "▼" : "▶"} Version {v.version}{" "}
                    {isCurrentVersion ? "(Current)" : ""} - {formatDate(v.analyzedAt)}
                  </button>
                </div>

                {isExpanded ? (
                  <div className="card-body_applicantindex">
                    <h6>Missing Competencies</h6>
                    {v.missingCriteria && v.missingCriteria.length > 0 ? (
                      <ul>
                        {v.missingCriteria.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-success">All competencies covered!</p>
                    )}

                    <h6>Curriculum Documents</h6>
                    {v.curriculumFiles && v.curriculumFiles.length > 0 ? (
                      <ul>
                        {v.curriculumFiles.map((pdf, index) => (
                          <li key={`${pdf.filename}-${index}`}>
                            <a href={pdf.signedUrl} target="_blank" rel="noreferrer">
                              <i className="fa fa-file-pdf-o" /> {pdf.filename}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted">No curriculum files</p>
                    )}

                    {v.applicationPackageFiles && v.applicationPackageFiles.length > 0 ? (
                      <>
                        <h6>Application Package Documents</h6>
                        <ul>
                          {v.applicationPackageFiles.map((pkg, index) => (
                            <li key={`${pkg.filename}-${index}`}>
                              <a href={pkg.signedUrl} target="_blank" rel="noreferrer">
                                <i className="fa fa-file-pdf-o" /> {pkg.filename}
                              </a>{" "}
                              <span className="text-muted">({pkg.label})</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}

                    {v.excelFile ? (
                      <>
                        <h6>Generated Competency Mapping</h6>
                        <ul>
                          <li>
                            <a
                              href={v.excelFile.signedUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <i className="fa fa-file-excel-o" /> {v.excelFile.filename}
                            </a>
                          </li>
                        </ul>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}