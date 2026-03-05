import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase/firebase";
import "../styles/reviewerindex.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

function formatDate(ts) {
  // supports Firestore timestamp { _seconds } or ISO string
  if (!ts) return "—";
  if (typeof ts === "string") {
    const d = new Date(ts);
    return isNaN(d.getTime())
      ? "—"
      : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }
  if (ts?._seconds) {
    const d = new Date(ts._seconds * 1000);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }
  return "—";
}

export default function ReviewerIndex() {
  const navigate = useNavigate();

  const [token, setToken] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState({ total: 0, unreviewed: 0, incomplete: 0, approved: 0 });

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalData, setModalData] = useState(null); 
  // modalData shape like: { application, pdfFiles, filledExcel }

  // Auth gate (reviewer only)
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

        const t = await user.getIdToken();
        setToken(t);
      } catch (e) {
        console.error(e);
        navigate("/", { replace: true });
      }
    });

    return () => unsub();
  }, [navigate]);

  // Load applications once token is ready
  useEffect(() => {
    if (!token) return;

    (async () => {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(`${API_BASE}/api/reviewer/applications`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || `Failed to load (${res.status})`);
        }

        setApplications(data.applications || []);
        setStats(
          data.stats || {
            total: (data.applications || []).length,
            unreviewed: 0,
            incomplete: 0,
            approved: 0,
          }
        );
      } catch (e) {
        setError(e?.message || "Failed to load applications.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function handleLogout() {
    await signOut(auth);
    navigate("/", { replace: true });
  }

  // Update status
  async function updateStatus(appId, newStatus) {
    if (!token) return;

    // Optimistic update UI
    setApplications((prev) =>
      prev.map((a) => (a._id === appId ? { ...a, status: newStatus } : a))
    );

    try {
      const res = await fetch(`${API_BASE}/api/reviewer/applications/${appId}/status`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Update failed (${res.status})`);
      }

      // Recompute stats locally (like your old code)
      setStatsFromList((list) =>
        list.map((a) => (a._id === appId ? { ...a, status: newStatus } : a))
      );
    } catch (e) {
      // Revert on failure by reloading list (simplest + reliable)
      console.error(e);
      setError(e?.message || "Failed to update status.");
      // Reload applications quickly
      refresh();
    }
  }

  function setStatsFromList(nextApplicationsOrUpdater) {
    setApplications((prev) => {
      const next =
        typeof nextApplicationsOrUpdater === "function"
          ? nextApplicationsOrUpdater(prev)
          : nextApplicationsOrUpdater;

      const counts = { Unreviewed: 0, Incomplete: 0, Approved: 0 };
      next.forEach((a) => {
        if (counts[a.status] !== undefined) counts[a.status] += 1;
      });

      setStats({
        total: next.length,
        unreviewed: counts.Unreviewed,
        incomplete: counts.Incomplete,
        approved: counts.Approved,
      });

      return next;
    });
  }

  async function refresh() {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/reviewer/applications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || `Failed (${res.status})`);
      setApplications(data.applications || []);
      setStats(data.stats || { total: 0, unreviewed: 0, incomplete: 0, approved: 0 });
    } catch (e) {
      setError(e?.message || "Failed to refresh.");
    } finally {
      setLoading(false);
    }
  }

  // View application details (modal)
  async function viewApplication(appId) {
    if (!token) return;

    setModalOpen(true);
    setModalLoading(true);
    setModalError("");
    setModalData(null);

    try {
      const res = await fetch(`${API_BASE}/api/reviewer/applications/${appId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Failed to load (${res.status})`);
      }

      setModalData({
        application: data.application,
        pdfFiles: data.pdfFiles || [],
        filledExcel: data.filledExcel || null,
      });
    } catch (e) {
      setModalError(e?.message || "Failed to load details.");
    } finally {
      setModalLoading(false);
    }
  }

  const tableBody = useMemo(() => {
    if (loading) {
      return (
        <tr>
          <td colSpan="7" className="text-center">
            <i className="fa fa-spinner fa-spin" /> Loading...
          </td>
        </tr>
      );
    }

    if (!applications.length) {
      return (
        <tr>
          <td colSpan="7" className="text-center">
            No applications
          </td>
        </tr>
      );
    }

    return applications.map((app) => (
      <tr key={app._id}>
        <td>
          <strong>{app.applicationId}</strong>
        </td>
        <td>{app.providerName}</td>
        <td>{app.organizationName}</td>
        <td>{app.email}</td>
        <td>{formatDate(app.submittedDate)}</td>
        <td style={{ minWidth: 160 }}>
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
          <button className="btn btn-sm btn-blue" onClick={() => viewApplication(app._id)}>
            <i className="fa fa-eye" /> View
          </button>
        </td>
      </tr>
    ));
  }, [applications, loading]);

  return (
    <div className="wsbc-page_reviewer">
      <div className="main-container_reviewer">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <img
            src="https://ux-static.online.worksafebc.com/css/assets/img/worksafebc-logo.jpg"
            alt="WorkSafeBC"
            className="logo"
            style={{ margin: 0 }}
          />
          <button className="btn btn-outline-grey" onClick={handleLogout}>
            <i className="fa fa-sign-out" /> Logout
          </button>
        </div>

        <h1>Training Provider Application Reviews</h1>

        {error ? <div className="wsbc-alert wsbc-alert-warning">{error}</div> : null}

        <div className="stats-row">
          <div className="stat-card stat-unreviewed">
            <h3>{stats.unreviewed}</h3>
            <p>Unreviewed</p>
          </div>

          <div className="stat-card stat-incomplete">
            <h3>{stats.incomplete}</h3>
            <p>Incomplete</p>
          </div>

          <div className="stat-card stat-approved">
            <h3>{stats.approved}</h3>
            <p>Approved</p>
          </div>

          <div className="stat-card stat-total">
            <h3>{stats.total}</h3>
            <p>Total Applications</p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-striped" id="applicationsTable">
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
            <tbody>{tableBody}</tbody>
          </table>
        </div>
      </div>

      {/* React Modal */}
      {modalOpen ? (
        <div className="wsbc-modal-overlay" onMouseDown={() => setModalOpen(false)}>
          <div className="wsbc-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="wsbc-modal-header">
              <h5 className="wsbc-modal-title">Application Details</h5>
              <button className="wsbc-modal-close" onClick={() => setModalOpen(false)}>
                &times;
              </button>
            </div>

            <div className="wsbc-modal-body">
              {modalLoading ? (
                <p className="text-center">
                  <i className="fa fa-spinner fa-spin" /> Loading...
                </p>
              ) : modalError ? (
                <div className="wsbc-alert wsbc-alert-warning">{modalError}</div>
              ) : modalData ? (
                <ModalContent data={modalData} />
              ) : null}
            </div>

            <div className="wsbc-modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ModalContent({ data }) {
  const app = data.application;
  const missing = app?.missingCriteria || [];

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

      <hr />
      <h5>Missing Competencies</h5>
      {missing.length > 0 ? (
        <ul>
          {missing.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ) : (
        <p className="text-success">All covered!</p>
      )}

      <hr />
      <h5>Uploaded Documents</h5>
      {data.pdfFiles?.length > 0 ? (
        <ul>
          {data.pdfFiles.map((pdf) => (
            <li key={pdf.signedUrl || pdf.filename}>
              <a href={pdf.signedUrl} target="_blank" rel="noreferrer">
                {pdf.filename}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p>—</p>
      )}

      {data.filledExcel ? (
        <>
          <hr />
          <h5>Curriculum Mapping</h5>
          <ul>
            <li>
              <a href={data.filledExcel.signedUrl} target="_blank" rel="noreferrer">
                {data.filledExcel.filename}
              </a>
            </li>
          </ul>
        </>
      ) : null}
    </div>
  );
}