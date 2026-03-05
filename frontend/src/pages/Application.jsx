import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/firebase";
import "../styles/application.css";

const MAX_MB = 10;

function formatMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(2);
}

export default function Application() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [authToken, setAuthToken] = useState(null);

  const [providerName, setProviderName] = useState("");
  const [organizationName, setOrganizationName] = useState("");

  const [selectedFile, setSelectedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const [loading, setLoading] = useState(false);

  const [result, setResult] = useState(null); // { applicationId, application: { missingCriteria: [] } }
  const [error, setError] = useState("");

  // Gate page by auth + role (applicant only)
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
      } catch (e) {
        console.error(e);
        navigate("/", { replace: true });
      }
    });

    return () => unsub();
  }, [navigate]);

  const fileInfo = useMemo(() => {
    if (!selectedFile) return null;
    return {
      name: selectedFile.name,
      sizeMB: formatMB(selectedFile.size),
    };
  }, [selectedFile]);

  function validateAndSetFile(file) {
    setError("");

    if (!file) return;

    // Only PDF
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please select a PDF file.");
      return;
    }

    // Max 10MB
    const maxBytes = MAX_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(`File size must be less than ${MAX_MB}MB.`);
      return;
    }

    setSelectedFile(file);
  }

  function onFileChange(e) {
    const file = e.target.files?.[0];
    validateAndSetFile(file);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);

    const file = e.dataTransfer.files?.[0];
    validateAndSetFile(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!authToken) {
      setError("Auth token not ready yet. Please try again.");
      return;
    }

    if (!selectedFile) {
      setError("Please select a PDF file.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("providerName", providerName);
      formData.append("organizationName", organizationName);
      formData.append("pdf", selectedFile);

      const API_BASE = import.meta.env.VITE_API_BASE_URL;

        const token = await auth.currentUser.getIdToken(true);

        const response = await fetch(`${API_BASE}/api/applications/submit`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            },
        body: formData,
        });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.success) {
        const msg = data?.error || `Request failed (${response.status})`;
        throw new Error(msg);
      }

      setResult(data);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Error submitting application.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setProviderName("");
    setOrganizationName("");
    setSelectedFile(null);
    setResult(null);
    setError("");
    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Results screen
  if (result) {
    const missing = result?.application?.missingCriteria || [];

    return (
      <div className="wsbc-page_application">
        <div className="main-container_application">
          <img
            src="https://ux-static.online.worksafebc.com/css/assets/img/worksafebc-logo.jpg"
            alt="WorkSafeBC"
            className="logo"
          />

          <div className="success-message">
            <h3>
              <i className="fa fa-check-circle" /> Application Submitted Successfully
            </h3>
            <p>
              Your application ID: <strong>{result.applicationId}</strong>
            </p>
          </div>

          {missing.length > 0 ? (
            <div className="missing-criteria">
              <h3>
                <i className="fa fa-exclamation-triangle" /> Missing Competencies
              </h3>
              <p>The following competencies were not found in your curriculum:</p>
              <ul>
                {missing.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="success-message">
              <h3>
                <i className="fa fa-check-circle" /> All competencies are covered!
              </h3>
            </div>
          )}

          <div className="text-center mt-4">
            <button type="button" className="btn btn-outline-blue" onClick={resetForm}>
              <i className="fa fa-plus" /> Submit Another Application
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Form screen
  return (
    <div className="wsbc-page_application">
      <div className="main-container_application">
        <img
          src="https://ux-static.online.worksafebc.com/css/assets/img/worksafebc-logo.jpg"
          alt="WorkSafeBC"
          className="logo_application"
        />

        <h1>Asbestos Abatement Training Provider Application</h1>
        <p className="mb-4">Submit your training curriculum for WorkSafeBC approval.</p>

        {error ? <div className="wsbc-alert wsbc-alert-warning">{error}</div> : null}

        {!loading ? (
          <form onSubmit={handleSubmit}>
            <div className="form-section">
              <h2 className="subtitle-orange">Contact Information</h2>

              <div className="form-group">
                <label htmlFor="providerName">
                  Your Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="providerName"
                  required
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="organizationName">
                  Organization Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="organizationName"
                  required
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                />
              </div>
            </div>

            <div className="form-section">
              <h2 className="subtitle-orange">Course Curriculum</h2>

              <div
                className={`file-upload-area ${dragOver ? "is-dragover" : ""}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                }}
                onDrop={onDrop}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                }}
              >
                <i className="fa fa-upload fa-3x mb-3 upload-icon" />
                <p>
                  <strong>Click to select file</strong> or drag and drop here
                </p>
                <p className="text-muted">PDF format, maximum 10MB</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={onFileChange}
                style={{ display: "none" }}
              />

              {fileInfo ? (
                <div className="file-info">
                  <i className="fa fa-file-pdf-o" /> {fileInfo.name} ({fileInfo.sizeMB} MB)
                </div>
              ) : null}
            </div>

            <div className="text-center">
              <button type="submit" className="btn btn-orange btn-lg" disabled={loading}>
                <i className="fa fa-paper-plane" /> Submit Application
              </button>
            </div>
          </form>
        ) : (
          <div className="loading-spinner">
            <div className="spinner" />
            <h3>Analyzing your curriculum...</h3>
            <p>This may take up to a minute. Please don&apos;t close this window.</p>
          </div>
        )}
      </div>
    </div>
  );
}