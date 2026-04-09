import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { API_BASE_URL } from "../config/constants";
import "../styles/reviewerindex.css";

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

export default function ReviewerIndex() {
  const navigate = useNavigate();

  const [authToken, setAuthToken] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        const role = tokenResult?.claims?.role;

        if (role !== "reviewer") {
          await signOut(auth);
          navigate("/", { replace: true });
          return;
        }

        const token = await user.getIdToken();
        setAuthToken(token);
      } catch (err) {
        console.error(err);
        navigate("/", { replace: true });
      }
    });

    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    if (!authToken) return;
    loadApplications();
  }, [authToken]);

  async function loadApplications() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/reviewer/applications`, {
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

  async function handleLogout() {
    await signOut(auth);
    navigate("/", { replace: true });
  }

  async function updateStatus(id, status) {
    const previousApplications = applications;

    setApplications((prev) =>
      prev.map((app) => (app._id === id ? { ...app, status } : app))
    );

    try {
      const response = await fetch(`${API_BASE_URL}/api/reviewer/applications/${id}/status`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || `Failed to update (${response.status})`);
      }
    } catch (err) {
      console.error(err);
      setApplications(previousApplications);
      setError(err?.message || "Failed to update status.");
    }
  }

  async function viewApplication(id) {
    setModalOpen(true);
    setModalLoading(true);
    setModalError("");
    setModalData(null);
    setExpandedVersions({});

    try {
      const response = await fetch(`${API_BASE_URL}/api/reviewer/applications/${id}`, {
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
    <div className="wsbc-page_reviewer">
      <div className="main-container_reviewer">
        <div className="header-bar_reviewer">
          <img
            src="https://ux-static.online.worksafebc.com/css/assets/img/worksafebc-logo.jpg"
            alt="WorkSafeBC"
            className="logo_reviewer"
            style={{ margin: 0 }}
          />

          <button className="btn btn-outline-grey" onClick={handleLogout}>
            <i className="fa fa-sign-out" /> Logout
          </button>
        </div>

        <h1>Training Provider Application Reviews</h1>

        {error ? <div className="alert-warning_reviewer">{error}</div> : null}

        <div className="stats-row_reviewer">
          <div className="stat-card_reviewer stat-unreviewed_reviewer">
            <h3>{stats.unreviewed}</h3>
            <p>Unreviewed</p>
          </div>

          <div className="stat-card_reviewer stat-incomplete_reviewer">
            <h3>{stats.incomplete}</h3>
            <p>Incomplete</p>
          </div>

          <div className="stat-card_reviewer stat-approved_reviewer">
            <h3>{stats.approved}</h3>
            <p>Approved</p>
          </div>

          <div className="stat-card_reviewer stat-total_reviewer">
            <h3>{stats.total}</h3>
            <p>Total Applications</p>
          </div>
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
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center">
                    No applications yet.
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app._id}>
                    <td>
                      <strong>{app.applicationId}</strong>
                    </td>
                    <td>{app.providerName}</td>
                    <td>{app.organizationName}</td>
                    <td>{app.email}</td>
                    <td>{formatDate(app.submittedDate)}</td>
                    <td>
                      <select
                        className="form-control form-control-sm"
                        value={app.status}
                        onChange={(e) => updateStatus(app._id, e.target.value)}
                      >
                        <option value="Unreviewed">Unreviewed</option>
                        <option value="Incomplete">Incomplete</option>
                        <option value="Approved">Approved</option>
                      </select>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-blue"
                        onClick={() => viewApplication(app._id)}
                      >
                        <i className="fa fa-eye" /> View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen ? (
        <div
          className="modal-overlay_reviewer"
          onMouseDown={() => setModalOpen(false)}
        >
          <div
            className="modal-box_reviewer"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-header_reviewer">
              <h5 className="modal-title_reviewer">Application Details</h5>
              <button
                className="modal-close_reviewer"
                onClick={() => setModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <div className="modal-body_reviewer">
              {modalLoading ? (
                <p className="text-center">
                  <i className="fa fa-spinner fa-spin" /> Loading...
                </p>
              ) : modalError ? (
                <p className="text-danger">{modalError}</p>
              ) : modalData ? (
                <ReviewerModalContent
                  data={modalData}
                  expandedVersions={expandedVersions}
                  toggleVersion={toggleVersion}
                />
              ) : null}
            </div>

            <div className="modal-footer_reviewer">
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

function ReviewerModalContent({ data, expandedVersions, toggleVersion }) {
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
        <div className="accordion_reviewer">
          {versions.map((v) => {
            const isCurrentVersion = v.version === app.currentVersion;
            const isExpanded = !!expandedVersions[v.version];

            return (
              <div className="card_reviewer" key={v.version}>
                <div className="card-header_reviewer">
                  <button
                    className="btn-link_reviewer"
                    type="button"
                    onClick={() => toggleVersion(v.version)}
                  >
                    {isExpanded ? "▼" : "▶"} Version {v.version}{" "}
                    {isCurrentVersion ? "(Current)" : ""} - {formatDate(v.analyzedAt)}
                  </button>
                </div>

                {isExpanded ? (
                  <div className="card-body_reviewer">
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