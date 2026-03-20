import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/firebase";
import "../styles/application.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_CURRICULUM_FILES = 10;

function formatMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(2);
}

export default function Application() {
  const navigate = useNavigate();

  const curriculumInputRef = useRef(null);
  const providerApplicationFormRef = useRef(null);
  const courseOutlineRef = useRef(null);
  const administrationDocumentRef = useRef(null);

  const [authToken, setAuthToken] = useState(null);

  const [providerName, setProviderName] = useState("");
  const [organizationName, setOrganizationName] = useState("");

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [analysisResults, setAnalysisResults] = useState(null);

  const [providerApplicationForm, setProviderApplicationForm] = useState(null);
  const [courseOutline, setCourseOutline] = useState(null);
  const [administrationDocument, setAdministrationDocument] = useState(null);

  const [step, setStep] = useState(1); // 1 = curriculum, 2 = package, 3 = complete
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Analyzing your curriculum...");

  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const [dragCurriculum, setDragCurriculum] = useState(false);
  const [dragProviderForm, setDragProviderForm] = useState(false);
  const [dragCourseOutline, setDragCourseOutline] = useState(false);
  const [dragAdministrationDocument, setDragAdministrationDocument] = useState(false);

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
      } catch (err) {
        console.error(err);
        navigate("/", { replace: true });
      }
    });

    return () => unsub();
  }, [navigate]);

  const missingCriteria = useMemo(
    () => analysisResults?.missingCriteria || [],
    [analysisResults]
  );

  function validatePdfFile(file) {
    if (!file) return "No file selected.";
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return `File "${file.name}" is not a PDF.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File "${file.name}" exceeds 10MB.`;
    }
    return null;
  }

  function handleCurriculumFiles(files) {
    setError("");
    if (!files || files.length === 0) return;

    const incoming = Array.from(files);
    const validFiles = [];

    for (const file of incoming) {
      const validationError = validatePdfFile(file);
      if (validationError) {
        setError(validationError);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      setError("No valid PDF files selected.");
      return;
    }

    const limitedFiles = validFiles.slice(0, MAX_CURRICULUM_FILES);
    if (validFiles.length > MAX_CURRICULUM_FILES) {
      setError(`Maximum ${MAX_CURRICULUM_FILES} files allowed. Only the first ${MAX_CURRICULUM_FILES} will be used.`);
    }

    setSelectedFiles(limitedFiles);
    setAnalysisResults(null);
    setStep(1);
  }

  function removeCurriculumFile(indexToRemove) {
    setSelectedFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
    setAnalysisResults(null);
  }

  function handleSinglePackageFile(file, setter, inputRef) {
    setError("");
    const validationError = validatePdfFile(file);
    if (validationError) {
      setError(validationError);
      if (inputRef.current) inputRef.current.value = "";
      setter(null);
      return;
    }
    setter(file);
  }

  async function analyzeCurriculum() {
    setError("");

    if (!authToken) {
      setError("Authentication not ready yet. Please try again.");
      return;
    }

    if (!providerName.trim() || !organizationName.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    if (selectedFiles.length === 0) {
      setError("Please select at least one PDF file.");
      return;
    }

    setLoading(true);
    setLoadingText("Analyzing your curriculum...");

    try {
      const token = await auth.currentUser.getIdToken(true);

      const formData = new FormData();
      formData.append("providerName", providerName.trim());
      formData.append("organizationName", organizationName.trim());

      selectedFiles.forEach((file) => {
        formData.append("pdfs", file);
      });

      const response = await fetch(`${API_BASE}/api/applications/analyze`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `Analyze failed (${response.status})`);
      }

      setAnalysisResults(data.analysis);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Error analyzing curriculum.");
    } finally {
      setLoading(false);
    }
  }

  function resetFormForReanalyze() {
    setAnalysisResults(null);
    setSelectedFiles([]);
    setStep(1);
    if (curriculumInputRef.current) curriculumInputRef.current.value = "";
  }

  function continueToApplicationPackage() {
    setError("");

    if (selectedFiles.length === 0 || !analysisResults) {
      setError("Please analyze your curriculum first.");
      return;
    }

    setStep(2);
    window.scrollTo(0, 0);
  }

  function backToCurriculum() {
    setStep(1);
    window.scrollTo(0, 0);
  }

  function validatePackageFiles() {
    if (!providerApplicationForm || !courseOutline || !administrationDocument) {
      throw new Error("Please upload all 3 required application package documents.");
    }
  }

  async function submitApplication() {
    setError("");

    if (!authToken) {
      setError("Authentication not ready yet. Please try again.");
      return;
    }

    if (!analysisResults || selectedFiles.length === 0) {
      setError("Please analyze your curriculum first.");
      return;
    }

    try {
      validatePackageFiles();

      setLoading(true);
      setLoadingText("Submitting your application...");

      const token = await auth.currentUser.getIdToken(true);

      const formData = new FormData();
      formData.append("providerName", providerName.trim());
      formData.append("organizationName", organizationName.trim());
      formData.append("analysisResults", JSON.stringify(analysisResults));

      selectedFiles.forEach((file) => {
        formData.append("pdfs", file);
      });

      formData.append("applicationPackageFiles", providerApplicationForm);
      formData.append("applicationPackageFiles", courseOutline);
      formData.append("applicationPackageFiles", administrationDocument);

      const response = await fetch(`${API_BASE}/api/applications/submit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `Submit failed (${response.status})`);
      }

      setResult(data);
      setStep(3);
      window.scrollTo(0, 0);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Error submitting application.");
    } finally {
      setLoading(false);
    }
  }

  function renderSingleSelectedFile(file, clearFn) {
    if (!file) return null;

    return (
      <div className="file-item_application">
        <span>
          <i className="fa fa-file-pdf-o" /> {file.name} ({formatMB(file.size)} MB)
        </span>
        <span className="file-item-remove_application" onClick={clearFn}>
          <i className="fa fa-times" /> Remove
        </span>
      </div>
    );
  }

  return (
    <div className="wsbc-page_application">
      <div className="main-container_application">
        <img
          src="https://ux-static.online.worksafebc.com/css/assets/img/worksafebc-logo.jpg"
          alt="WorkSafeBC"
          className="logo_application"
        />

        <div className="progress-container_application">
          <div className="progress-steps_application">
            <div
              className={`progress-step_application ${
                step === 1 ? "active_application" : step > 1 ? "completed_application" : ""
              }`}
            >
              <div className="step-circle_application">1</div>
              <div className="step-label_application">
                Upload & Analyze
                <br />
                Curriculum
              </div>
            </div>

            <div
              className={`progress-step_application ${
                step === 2 ? "active_application" : step > 2 ? "completed_application" : ""
              }`}
            >
              <div className="step-circle_application">2</div>
              <div className="step-label_application">
                Upload Application
                <br />
                Package
              </div>
            </div>

            <div
              className={`progress-step_application ${
                step === 3 ? "completed_application" : ""
              }`}
            >
              <div className="step-circle_application">3</div>
              <div className="step-label_application">Submit</div>
            </div>
          </div>
        </div>

        <h1>Asbestos Abatement Training Provider Application</h1>

        {error ? <div className="alert-info_application">{error}</div> : null}

        {loading ? (
          <div className="loading-spinner_application">
            <div className="spinner_application" />
            <h3>{loadingText}</h3>
            <p>This may take up to a minute. Please don&apos;t close this window.</p>
          </div>
        ) : null}

        {!loading && !result && step === 1 ? (
          <>
            {!analysisResults ? (
              <form>
                <h2>Step 1: Upload All Curriculum Material</h2>
                <p className="mb-4">
                  Please upload all course slides, quizzes, workbooks, and content.
                </p>

                <div className="form-section_application">
                  <h2 className="subtitle-orange">Contact Information</h2>

                  <div className="form-group">
                    <label htmlFor="providerName_application">
                      Your Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="providerName_application"
                      required
                      value={providerName}
                      onChange={(e) => setProviderName(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="organizationName_application">
                      Organization Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="organizationName_application"
                      required
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-section_application">
                  <h2 className="subtitle-orange">Course Curriculum</h2>
                  <p className="text-muted">
                    Upload your training curriculum documents for AI-powered competency
                    analysis.
                  </p>

                  <div
                    className={`file-upload-area_application ${
                      dragCurriculum ? "dragover_application" : ""
                    }`}
                    onClick={() => curriculumInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragCurriculum(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setDragCurriculum(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragCurriculum(false);
                      handleCurriculumFiles(e.dataTransfer.files);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        curriculumInputRef.current?.click();
                      }
                    }}
                  >
                    <i className="fa fa-upload fa-3x mb-3 upload-icon_application" />
                    <p>
                      <strong>Click to select file</strong> or drag and drop here
                    </p>
                    <p className="text-muted">
                      PDF format, maximum 10MB per file, up to 10 files
                    </p>
                  </div>

                  <input
                    ref={curriculumInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    multiple
                    style={{ display: "none" }}
                    onChange={(e) => handleCurriculumFiles(e.target.files)}
                  />

                  {selectedFiles.length > 0 ? (
                    <div className="file-list_application">
                      {selectedFiles.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="file-item_application">
                          <span>
                            <i className="fa fa-file-pdf-o" /> {file.name} ({formatMB(file.size)} MB)
                          </span>
                          <span
                            className="file-item-remove_application"
                            onClick={() => removeCurriculumFile(index)}
                          >
                            <i className="fa fa-times" /> Remove
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="text-center btn-group_application">
                  <button
                    type="button"
                    className="btn btn-blue btn-lg"
                    onClick={analyzeCurriculum}
                  >
                    <i className="fa fa-search" /> Analyze Curriculum
                  </button>
                </div>
              </form>
            ) : (
              <div className="analysisSection_application">
                <div className="analysis-results_application">
                  <h3>
                    <i className="fa fa-check-circle" /> Analysis Complete
                  </h3>
                  {missingCriteria.length > 0 ? (
                    <p>
                      Analyzed {analysisResults.filesAnalyzed} file(s). The following
                      competencies are missing from your curriculum. You may upload different
                      files and re-analyze, or continue to the application package.
                    </p>
                  ) : (
                    <p>
                      Analyzed {analysisResults.filesAnalyzed} file(s). All competencies are
                      covered! Please continue to complete your application package.
                    </p>
                  )}
                </div>

                <div className="missingCriteriaSection_application">
                  {missingCriteria.length > 0 ? (
                    <div className="missing-criteria_application">
                      <h3>
                        <i className="fa fa-exclamation-triangle" /> Missing Competencies
                      </h3>
                      <ul>
                        {missingCriteria.map((criteria) => (
                          <li key={criteria}>{criteria}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>

                <div className="text-center btn-group_application">
                  <button
                    type="button"
                    className="btn btn-outline-blue btn-lg"
                    onClick={resetFormForReanalyze}
                  >
                    <i className="fa fa-refresh" /> Upload Different PDF
                  </button>
                  <button
                    type="button"
                    className="btn btn-orange btn-lg"
                    onClick={continueToApplicationPackage}
                  >
                    <i className="fa fa-arrow-right" /> Continue to Application Package
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}

        {!loading && !result && step === 2 ? (
          <div className="applicationPackageSection_application">
            <h2>Step 2: Upload Application Package Documents</h2>
            <p className="mb-4">
              Please upload the following required documents to complete your application.
            </p>

            <div className="form-section_application">
              <h2 className="subtitle-orange">2.1 Provider Application Form</h2>

              <div className="info-box_application">
                <h4>
                  <i className="fa fa-download" /> Download the Application Form
                </h4>
                <p>
                  Download the official WorkSafeBC Provider Application Form, fill it out,
                  and upload the completed form below.
                </p>
                <a
                  href="https://www.worksafebc.com/resources/health-safety/forms/asbestos-abatement-training-provider-application-form?lang=en&direct="
                  target="_blank"
                  rel="noreferrer"
                >
                  <i className="fa fa-external-link" /> Asbestos abatement training:
                  Provider application form | WorkSafeBC
                </a>
              </div>

              <label className="upload-label_application">
                Upload Completed Provider Application Form{" "}
                <span className="text-danger">*</span>
              </label>
              <p className="upload-description_application">PDF format, maximum 10MB</p>

              <div
                className={`file-upload-area_application ${
                  dragProviderForm ? "dragover_application" : ""
                }`}
                onClick={() => providerApplicationFormRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragProviderForm(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragProviderForm(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragProviderForm(false);
                  handleSinglePackageFile(
                    e.dataTransfer.files?.[0],
                    setProviderApplicationForm,
                    providerApplicationFormRef
                  );
                }}
              >
                <i className="fa fa-upload fa-2x mb-2 upload-icon_application" />
                <p>
                  <strong>Click to select file</strong> or drag and drop
                </p>
              </div>

              <input
                ref={providerApplicationFormRef}
                type="file"
                accept=".pdf,application/pdf"
                style={{ display: "none" }}
                onChange={(e) =>
                  handleSinglePackageFile(
                    e.target.files?.[0],
                    setProviderApplicationForm,
                    providerApplicationFormRef
                  )
                }
              />

              {renderSingleSelectedFile(providerApplicationForm, () => {
                setProviderApplicationForm(null);
                if (providerApplicationFormRef.current) {
                  providerApplicationFormRef.current.value = "";
                }
              })}
            </div>

            <div className="form-section_application">
              <h2 className="subtitle-orange">2.2 Course Outline and/or Training Agenda</h2>

              <div className="info-box_application">
                <h4>
                  <i className="fa fa-info-circle" /> What to Include
                </h4>
                <p>Your application package must include a course outline and/or training agenda that specifies:</p>
                <ul>
                  <li>Course title, course length, prerequisites (if applicable), and course fee</li>
                  <li>How the course will be delivered (online, in person, or blended)</li>
                  <li>A description of the topics covered and activities done during the course or training</li>
                </ul>
              </div>

              <label className="upload-label_application">
                Upload Course Outline <span className="text-danger">*</span>
              </label>
              <p className="upload-description_application">PDF format, maximum 10MB</p>

              <div
                className={`file-upload-area_application ${
                  dragCourseOutline ? "dragover_application" : ""
                }`}
                onClick={() => courseOutlineRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragCourseOutline(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragCourseOutline(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragCourseOutline(false);
                  handleSinglePackageFile(
                    e.dataTransfer.files?.[0],
                    setCourseOutline,
                    courseOutlineRef
                  );
                }}
              >
                <i className="fa fa-upload fa-2x mb-2 upload-icon_application" />
                <p>
                  <strong>Click to select file</strong> or drag and drop
                </p>
              </div>

              <input
                ref={courseOutlineRef}
                type="file"
                accept=".pdf,application/pdf"
                style={{ display: "none" }}
                onChange={(e) =>
                  handleSinglePackageFile(
                    e.target.files?.[0],
                    setCourseOutline,
                    courseOutlineRef
                  )
                }
              />

              {renderSingleSelectedFile(courseOutline, () => {
                setCourseOutline(null);
                if (courseOutlineRef.current) {
                  courseOutlineRef.current.value = "";
                }
              })}
            </div>

            <div className="form-section_application">
              <h2 className="subtitle-orange">2.3 Administration Document</h2>

              <div className="info-box_application">
                <h4>
                  <i className="fa fa-info-circle" /> What to Include
                </h4>
                <p>Your administration documents must provide information about:</p>
                <ul>
                  <li>
                    <strong>Instructor qualifications:</strong> The qualifications and
                    responsibilities of the person or people conducting the training
                    (and conducting the practical skills test for Level 2)
                  </li>
                  <li>
                    <strong>Training records maintenance:</strong> Your maintenance plan
                    for training records
                  </li>
                  <li>
                    <strong>Quality monitoring and evaluation:</strong> Your monitoring
                    and evaluation plan for maintaining the quality of training and
                    testing
                  </li>
                  <li>
                    <strong>Complaints and appeals:</strong> Your policy and procedures
                    related to complaints and appeals
                  </li>
                  <li>
                    <strong>Registration, withdrawal, and refunds:</strong> Your policy
                    and procedures for registration, withdrawal, and refund processes
                  </li>
                </ul>
              </div>

              <label className="upload-label_application">
                Upload Administration Document <span className="text-danger">*</span>
              </label>
              <p className="upload-description_application">PDF format, maximum 10MB</p>

              <div
                className={`file-upload-area_application ${
                  dragAdministrationDocument ? "dragover_application" : ""
                }`}
                onClick={() => administrationDocumentRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragAdministrationDocument(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragAdministrationDocument(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragAdministrationDocument(false);
                  handleSinglePackageFile(
                    e.dataTransfer.files?.[0],
                    setAdministrationDocument,
                    administrationDocumentRef
                  );
                }}
              >
                <i className="fa fa-upload fa-2x mb-2 upload-icon_application" />
                <p>
                  <strong>Click to select file</strong> or drag and drop
                </p>
              </div>

              <input
                ref={administrationDocumentRef}
                type="file"
                accept=".pdf,application/pdf"
                style={{ display: "none" }}
                onChange={(e) =>
                  handleSinglePackageFile(
                    e.target.files?.[0],
                    setAdministrationDocument,
                    administrationDocumentRef
                  )
                }
              />

              {renderSingleSelectedFile(administrationDocument, () => {
                setAdministrationDocument(null);
                if (administrationDocumentRef.current) {
                  administrationDocumentRef.current.value = "";
                }
              })}
            </div>

            <div className="text-center btn-group_application">
              <button
                type="button"
                className="btn btn-outline-blue btn-lg"
                onClick={backToCurriculum}
              >
                <i className="fa fa-arrow-left" /> Back to Curriculum
              </button>
              <button
                type="button"
                className="btn btn-orange btn-lg"
                onClick={submitApplication}
              >
                <i className="fa fa-paper-plane" /> Submit Application
              </button>
            </div>
          </div>
        ) : null}

        {!loading && result ? (
          <div className="resultsSection_application">
            <div className="success-message_application">
              <h3>
                <i className="fa fa-check-circle" /> Application Submitted Successfully
              </h3>
              <p>
                <strong>Application ID:</strong> {result.application?.applicationId}
              </p>
              <p>
                Your application has been submitted and is awaiting review by WorkSafeBC.
              </p>
              <div className="text-center mt-4">
                <button
                  type="button"
                  className="btn btn-blue btn-lg"
                  onClick={() => navigate("/applicant")}
                >
                  <i className="fa fa-list" /> View My Applications
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}