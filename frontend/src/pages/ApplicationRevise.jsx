import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/firebase";
import "../styles/applicationrevise.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export default function ApplicationRevise() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [authToken, setAuthToken] = useState(null);
  const [applicationId, setApplicationId] = useState(null);

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [analysisResults, setAnalysisResults] = useState(null);

  const [step, setStep] = useState(1); // 1,2,3
  const [loading, setLoading] = useState(false);

  const [providerForm, setProviderForm] = useState(null);
  const [courseOutline, setCourseOutline] = useState(null);
  const [adminDoc, setAdminDoc] = useState(null);

  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) {
      alert("Invalid application ID");
      navigate("/applicant", { replace: true });
      return;
    }
    setApplicationId(id);

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/", { replace: true });
        return;
      }

      const tokenResult = await user.getIdTokenResult(true);
      const role = tokenResult?.claims?.role;

      if (role === "reviewer") {
        navigate("/", { replace: true });
        return;
      }

      const token = await user.getIdToken();
      setAuthToken(token);
    });

    return () => unsub();
  }, [navigate, searchParams]);

  function handleCurriculumFiles(files) {
    const valid = Array.from(files).filter(
      (f) => f.type === "application/pdf" && f.size <= 10 * 1024 * 1024
    );

    if (valid.length === 0) {
      alert("No valid PDF files");
      return;
    }

    setSelectedFiles(valid.slice(0, 10));
  }

  async function analyzeCurriculum() {
    if (selectedFiles.length === 0) {
      alert("Upload files first");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("pdfs", file));

      const res = await fetch(`${API_BASE}/api/applications/analyze`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });

      const data = await res.json();

      if (!data.success) throw new Error(data.error);

      setAnalysisResults(data.analysis);
      setStep(2);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  function validatePackage() {
    if (!providerForm || !courseOutline || !adminDoc) {
      throw new Error("Upload all required documents");
    }
  }

  async function submitRevision() {
    try {
      validatePackage();
      setLoading(true);
      setStep(3);

      const formData = new FormData();
      formData.append("analysisResults", JSON.stringify(analysisResults));

      selectedFiles.forEach((f) => formData.append("pdfs", f));

      formData.append("applicationPackageFiles", providerForm);
      formData.append("applicationPackageFiles", courseOutline);
      formData.append("applicationPackageFiles", adminDoc);

      const res = await fetch(
        `${API_BASE}/api/applications/revise/${applicationId}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
          body: formData,
        }
      );

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      alert("Revision submitted!");
      navigate("/applicant", { replace: true });
    } catch (err) {
      alert(err.message);
      setStep(2);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wsbc-page_revise">
      <div className="main-container_revise">
        <img
          src="https://ux-static.online.worksafebc.com/css/assets/img/worksafebc-logo.jpg"
          className="logo_revise"
        />

        <h1>Revise Application</h1>

        {/* STEP 1 */}
        {step === 1 && (
          <>
            <h2>Step 1: Upload Curriculum</h2>

            <input
              type="file"
              multiple
              accept=".pdf"
              onChange={(e) => handleCurriculumFiles(e.target.files)}
            />

            <button className="btn btn-blue" onClick={analyzeCurriculum}>
              Analyze
            </button>
          </>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <>
            <h2>Step 2: Upload Application Package</h2>

            <input type="file" onChange={(e) => setProviderForm(e.target.files[0])} />
            <input type="file" onChange={(e) => setCourseOutline(e.target.files[0])} />
            <input type="file" onChange={(e) => setAdminDoc(e.target.files[0])} />

            <button className="btn btn-orange" onClick={submitRevision}>
              Submit Revision
            </button>
          </>
        )}

        {loading && <p>Loading...</p>}
      </div>
    </div>
  );
}