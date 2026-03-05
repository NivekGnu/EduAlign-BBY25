import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { API_BASE_URL } from "../utils/api";
import "../styles/applicantindex.css";

function formatDate(ts) {
  if (!ts) return "—";
  const date = ts?._seconds ? new Date(ts._seconds * 1000) : new Date(ts);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Modal({ title, isOpen, onClose, children }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop_applicant" onClick={onClose}>
      <div
        className="modal-panel_applicant"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header_applicant">
          <h5 className="modal-title">{title}</h5>
          <button className="btn btn-outline-grey" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body_applicant">{children}</div>

        <div className="modal-footer_applicant">
          <button className="btn btn-outline-grey" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ApplicantIndex() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const [authToken, setAuthToken] = useState("");
  const [applications, setApplications] = useState([]);
  const [tableError, setTableError] = useState("");

  const [viewOpen, setViewOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState("");
  const [viewData, setViewData] = useState(null); // { application, pdfFiles, filledExcel }

  const stats = useMemo(() => {
    const total = applications.length;
    const unreviewed = applications.filter((a) => a.status === "Unreviewed").length;
    const incomplete = applications.filter((a) => a.status === "Incomplete").length;
    const approved = applications.filter((a) => a.status === "Approved").length;
    return { total, unreviewed, incomplete, approved };
  }, [applications]);

  // Auth guard + role check
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        navigate("/", { replace: true });
        return;
      }

      try {
        const tokenResult = await u.getIdTokenResult(true);
        const role = tokenResult?.claims?.role || "applicant";

        if (role === "reviewer") {
          navigate("/", { replace: true });
          return;
        }

        const token = await u.getIdToken();
        setUser(u);
        setAuthToken(token);
      } catch (err) {
        navigate("/", { replace: true });
      }
    });

    return () => unsub();
  }, [navigate]);

  // Load applications once we have token
  useEffect(() => {
    if (!authToken) return;

    (async () => {
      setLoading(true);
      setTableError("");

      try {
        const res = await fetch(`${API_BASE_URL}/api/applications/my-applications`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result.error || "Failed to load applications");
        }

        setApplications(result.applications || []);
      } catch (err) {
        setTableError(err.message || "Error loading applications");
      } finally {
        setLoading(false);
      }
    })();
  }, [authToken]);

  async function handleLogout() {
    await signOut(auth);
    navigate("/", { replace: true });
  }

  async function openView(id) {
    setViewOpen(true);
    setViewLoading(true);
    setViewError("");
    setViewData(null);

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/applications/my-applications/${id}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Failed to load application details");
      }

      setViewData(result);
    } catch (err) {
      setViewError(err.message || "Error loading application");
    } finally {
      setViewLoading(false);
    }
  }

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
              {user ? `Welcome, ${user.displayName || user.email}!` : "Loading..."}
            </p>
          </div>

          <div>
            <button onClick={handleLogout} className="btn btn-outline-grey">
              <i className="fa fa-sign-out" /> Logout
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-row_applicantindex">
          <div className="stat-card_applicantindex stat-unreviewed">
            <h3>{stats.unreviewed}</h3>
            <p>Unreviewed</p>
          </div>
          <div className="stat-card_applicantindex stat-incomplete">
            <h3>{stats.incomplete}</h3>
            <p>Incomplete</p>
          </div>
          <div className="stat-card_applicantindex stat-approved">
            <h3>{stats.approved}</h3>
            <p>Approved</p>
          </div>
          <div className="stat-card_applicantindex stat-total">
            <h3>{stats.total}</h3>
            <p>Total Applications</p>
          </div>
        </div>

        <div className="mb-4">
          <Link to="/application" className="btn btn-orange">
            <i className="fa fa-plus" /> Submit New Application
          </Link>
        </div>

        {/* Table */}
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
              ) : tableError ? (
                <tr>
                  <td colSpan="7" className="text-center text-danger">
                    Error: {tableError}
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
                  const statusClass =
                    app.status === "Unreviewed"
                      ? "status-unreviewed"
                      : app.status === "Incomplete"
                      ? "status-incomplete"
                      : "status-approved";

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
                      <td>
                        <button
                          className="btn btn-sm btn-blue"
                          onClick={() => openView(app._id)}
                        >
                          <i className="fa fa-eye" /> View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* View modal */}
        <Modal
          title="Application Details"
          isOpen={viewOpen}
          onClose={() => setViewOpen(false)}
        >
          {viewLoading ? (
            <p>
              <i className="fa fa-spinner fa-spin" /> Loading...
            </p>
          ) : viewError ? (
            <p className="text-danger">Error: {viewError}</p>
          ) : viewData ? (
            <div>
              <h4>
                {viewData.application?.applicationId} - {viewData.application?.providerName}
              </h4>

              <p>
                <strong>Organization:</strong> {viewData.application?.organizationName}
              </p>
              <p>
                <strong>Email:</strong> {viewData.application?.email}
              </p>
              <p>
                <strong>Status:</strong> {viewData.application?.status}
              </p>
              <p>
                <strong>Submitted:</strong> {formatDate(viewData.application?.submittedDate)}
              </p>

              <hr />
              <h5>Missing Competencies</h5>
              {viewData.application?.missingCriteria?.length ? (
                <ul>
                  {viewData.application.missingCriteria.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-success">All competencies covered!</p>
              )}

              <hr />
              <h5>Uploaded Documents</h5>
              {viewData.pdfFiles?.length ? (
                <ul>
                  {viewData.pdfFiles.map((pdf) => (
                    <li key={pdf.signedUrl}>
                      <a href={pdf.signedUrl} target="_blank" rel="noreferrer">
                        {pdf.filename}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">No documents found.</p>
              )}

              {viewData.filledExcel ? (
                <>
                  <hr />
                  <h5>Curriculum Mapping</h5>
                  <ul>
                    <li>
                      <a href={viewData.filledExcel.signedUrl} target="_blank" rel="noreferrer">
                        {viewData.filledExcel.filename}
                      </a>
                    </li>
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}
        </Modal>
      </div>
    </div>
  );
}