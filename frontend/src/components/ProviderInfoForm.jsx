import { useState } from "react";
import "../styles/application.css";

const DELIVERY_MODELS = ["In person", "Online", "Blended (online + in person)"];


const CERT_LEVELS = [
  { id: "level1", label: "Level 1: Foundational Awareness" },
  { id: "level2", label: "Level 2: Asbestos Safety" },
  { id: "level3", label: "Level 3: Asbestos Safety Leader" },
  { id: "levelS", label: "Level S: Surveyor Safety" },
];

const EMPTY_FORM = {
  certLevels: [],
  organizationName: "",
  mailingAddress: "",
  primaryContactName: "",
  phoneNumber: "",
  emailAddress: "",
  companyWebsite: "",
  worksafeBCAccountNumber: "",
  providerType: "", // "accredited" | "public_private"
  accreditationStandard: "",
  trainingFacilityLocations: "",
  deliveryModel: "",
  programLengthHours: "",
  languages: "",
  expectedLaunchDate: "",
};

export default function ProviderInfoForm({ initialData = {}, onBack, onContinue }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initialData });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function toggleCertLevel(id) {
    setForm((prev) => {
      const current = prev.certLevels || [];
      return {
        ...prev,
        certLevels: current.includes(id)
          ? current.filter((l) => l !== id)
          : [...current, id],
      };
    });
    setErrors((prev) => ({ ...prev, certLevels: undefined }));
  }

  function validate() {
    const e = {};
    if (!form.certLevels || form.certLevels.length === 0)
      e.certLevels = "Please select at least one certification level.";
    if (!form.organizationName.trim()) e.organizationName = "Required.";
    if (!form.mailingAddress.trim()) e.mailingAddress = "Required.";
    if (!form.primaryContactName.trim()) e.primaryContactName = "Required.";
    if (!form.phoneNumber.trim()) e.phoneNumber = "Required.";
    if (!form.emailAddress.trim()) e.emailAddress = "Required.";
    if (!form.providerType) e.providerType = "Please select a provider type.";
    if (form.providerType === "accredited" && !form.accreditationStandard.trim())
      e.accreditationStandard = "Please specify your accreditation standard.";
    if (!form.trainingFacilityLocations.trim())
      e.trainingFacilityLocations = "Required.";
    if (!form.deliveryModel) e.deliveryModel = "Required.";
    if (!form.programLengthHours) e.programLengthHours = "Required.";
    if (!form.languages.trim()) e.languages = "Required.";
    if (!form.expectedLaunchDate) {e.expectedLaunchDate = "Required.";
} else {
  const date = new Date(form.expectedLaunchDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 10);

  if (isNaN(date.getTime())) {
    e.expectedLaunchDate = "Please enter a valid date.";
  } else if (date < today) {
    e.expectedLaunchDate = "Launch date must be in the future.";
  } else if (date > maxDate) {
    e.expectedLaunchDate = "Launch date must be within the next 10 years.";
  }
}
    return e;
  }

  function handleContinue() {
    setSubmitted(true);
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      window.scrollTo(0, 0);
      return;
    }
    onContinue(form);
  }

  return (
    <div>
      <h2>Step 2: Provider Information</h2>
      <p className="mb-4">
        Complete the Provider Application Form below. This replaces the need to
        download and upload the PDF version.
      </p>

      {submitted && Object.keys(errors).length > 0 && (
        <div className="alert-info_application" style={{ marginBottom: 20 }}>
          Please fix the errors below before continuing.
        </div>
      )}

      {/* ── Certification Level ── */}
      <div className="form-section_application">
        <h2 className="subtitle-orange">Certification Level</h2>
        <p className="text-muted" style={{ marginBottom: 8 }}>
          This application is to become an approved training provider for (select
          all that apply):
        </p>
        <p className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
          <strong>Note:</strong> If you are applying to train more than one level,
          you will need to submit a separate application package for each.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginBottom: 4,
          }}
        >
          {CERT_LEVELS.map(({ id, label }) => {
            const checked = (form.certLevels || []).includes(id);
            return (
              <label
                key={id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  border: checked ? "1.5px solid #6399ae" : "1px solid #c9c5c1",
                  borderRadius: 4,
                  background: checked ? "#e0ebef" : "#fafafa",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCertLevel(id)}
                  style={{ accentColor: "#6399ae", width: 16, height: 16 }}
                />
                {label}
              </label>
            );
          })}
        </div>
        {submitted && errors.certLevels && (
          <p style={{ color: "#d32f2f", fontSize: 13, marginTop: 4 }}>
            {errors.certLevels}
          </p>
        )}
      </div>

      {/* ── Organization Information ── */}
      <div className="form-section_application">
        <h2 className="subtitle-orange">Organization Information</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div>
            <label className="upload-label_application">
              Organization name <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              className="form-control"
              value={form.organizationName}
              onChange={(e) => setField("organizationName", e.target.value)}
              placeholder="e.g. ABC Safety Training Ltd."
            />
            {submitted && errors.organizationName && (
              <p style={{ color: "#d32f2f", fontSize: 13 }}>
                {errors.organizationName}
              </p>
            )}
          </div>

          <div>
            <label className="upload-label_application">
              Mailing address <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              className="form-control"
              value={form.mailingAddress}
              onChange={(e) => setField("mailingAddress", e.target.value)}
              placeholder="Street, city, province, postal code"
            />
            {submitted && errors.mailingAddress && (
              <p style={{ color: "#d32f2f", fontSize: 13 }}>
                {errors.mailingAddress}
              </p>
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div>
            <label className="upload-label_application">
              Primary contact name and role <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              className="form-control"
              value={form.primaryContactName}
              onChange={(e) => setField("primaryContactName", e.target.value)}
              placeholder="e.g. Jane Doe, Training Coordinator"
            />
            {submitted && errors.primaryContactName && (
              <p style={{ color: "#d32f2f", fontSize: 13 }}>
                {errors.primaryContactName}
              </p>
            )}
          </div>

          <div>
            <label className="upload-label_application">
              Phone number <span className="text-danger">*</span>
            </label>
            <input
              type="tel"
              className="form-control"
              value={form.phoneNumber}
              onChange={(e) => setField("phoneNumber", e.target.value)}
              placeholder="e.g. 604-555-0100"
            />
            {submitted && errors.phoneNumber && (
              <p style={{ color: "#d32f2f", fontSize: 13 }}>
                {errors.phoneNumber}
              </p>
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div>
            <label className="upload-label_application">
              Email address <span className="text-danger">*</span>
            </label>
            <input
              type="email"
              className="form-control"
              value={form.emailAddress}
              onChange={(e) => setField("emailAddress", e.target.value)}
              placeholder="contact@example.com"
            />
            {submitted && errors.emailAddress && (
              <p style={{ color: "#d32f2f", fontSize: 13 }}>
                {errors.emailAddress}
              </p>
            )}
          </div>

          <div>
            <label className="upload-label_application">
              Company website{" "}
              <span style={{ color: "#888", fontWeight: 400, fontSize: 13 }}>
                (optional)
              </span>
            </label>
            <input
              type="url"
              className="form-control"
              value={form.companyWebsite}
              onChange={(e) => setField("companyWebsite", e.target.value)}
              placeholder="https://example.com"
            />
          </div>

          <div>
            <label className="upload-label_application">
              WorkSafeBC account number{" "}
              <span style={{ color: "#888", fontWeight: 400, fontSize: 13 }}>
                (if applicable)
              </span>
            </label>
            <input
              type="text"
              className="form-control"
              value={form.worksafeBCAccountNumber}
              onChange={(e) =>
                setField("worksafeBCAccountNumber", e.target.value)
              }
              placeholder="e.g. 123456"
            />
          </div>
        </div>

        {/* Provider Type */}
        <div>
          <label className="upload-label_application" style={{ marginBottom: 8 }}>
            Type of training provider <span className="text-danger">*</span>
          </label>

          {[
            {
              value: "accredited",
              label:
                "Provider currently accredited to an international assessment-based certificate or certification standard",
            },
            {
              value: "public_private",
              label:
                "Public organization or private company with no current accreditation",
            },
          ].map(({ value, label }) => (
            <label
              key={value}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "12px 14px",
                border:
                  form.providerType === value
                    ? "1.5px solid #6399ae"
                    : "1px solid #c9c5c1",
                borderRadius: 4,
                background: form.providerType === value ? "#e0ebef" : "#fafafa",
                cursor: "pointer",
                fontSize: 14,
                marginBottom: 8,
              }}
            >
              <input
                type="radio"
                name="providerType"
                value={value}
                checked={form.providerType === value}
                onChange={() => {
                  setField("providerType", value);
                  if (value !== "accredited") {
                    setField("accreditationStandard", "");
                  }
                }}
                style={{ accentColor: "#6399ae", marginTop: 2 }}
              />
              <span>{label}</span>
            </label>
          ))}

          {form.providerType === "accredited" && (
            <div style={{ marginTop: 8 }}>
              <label className="upload-label_application">
                Specify accreditation standard{" "}
                <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={form.accreditationStandard}
                onChange={(e) =>
                  setField("accreditationStandard", e.target.value)
                }
                placeholder="e.g. ISO 9001, IACET"
              />
              {submitted && errors.accreditationStandard && (
                <p style={{ color: "#d32f2f", fontSize: 13 }}>
                  {errors.accreditationStandard}
                </p>
              )}
            </div>
          )}

          {submitted && errors.providerType && (
            <p style={{ color: "#d32f2f", fontSize: 13 }}>
              {errors.providerType}
            </p>
          )}
        </div>
      </div>

      {/* ── Details of Training Program ── */}
      <div className="form-section_application">
        <h2 className="subtitle-orange">Details of Training Program</h2>

        <div style={{ marginBottom: 16 }}>
          <label className="upload-label_application">
            Training facility location(s) <span className="text-danger">*</span>
          </label>
          <textarea
            className="form-control"
            rows={3}
            value={form.trainingFacilityLocations}
            onChange={(e) => setField("trainingFacilityLocations", e.target.value)}
            placeholder="List all locations where training will be delivered"
            style={{ resize: "vertical" }}
          />
          {submitted && errors.trainingFacilityLocations && (
            <p style={{ color: "#d32f2f", fontSize: 13 }}>
              {errors.trainingFacilityLocations}
            </p>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div>
            <label className="upload-label_application">
              Training delivery model <span className="text-danger">*</span>
            </label>
            <select
              className="form-control"
              value={form.deliveryModel}
              onChange={(e) => setField("deliveryModel", e.target.value)}
            >
              <option value="">Select a model</option>
              {DELIVERY_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            {submitted && errors.deliveryModel && (
              <p style={{ color: "#d32f2f", fontSize: 13 }}>
                {errors.deliveryModel}
              </p>
            )}
          </div>

          <div>
            <label className="upload-label_application">
              Length of training program (instructional hours){" "}
              <span className="text-danger">*</span>
            </label>
            <input
              type="number"
              className="form-control"
              value={form.programLengthHours}
              onChange={(e) => setField("programLengthHours", e.target.value)}
              placeholder="e.g. 8"
              min={0}
            />
            {submitted && errors.programLengthHours && (
              <p style={{ color: "#d32f2f", fontSize: 13 }}>
                {errors.programLengthHours}
              </p>
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          <div>
            <label className="upload-label_application">
              Language(s) of training and materials{" "}
              <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              className="form-control"
              value={form.languages}
              onChange={(e) => setField("languages", e.target.value)}
              placeholder="e.g. English, French"
            />
            {submitted && errors.languages && (
              <p style={{ color: "#d32f2f", fontSize: 13 }}>
                {errors.languages}
              </p>
            )}
          </div>

          <div>
            <label className="upload-label_application">
              Expected training launch date{" "}
              <span className="text-danger">*</span>
            </label>
            <input
              type="date"
              className="form-control"
              value={form.expectedLaunchDate}
              onChange={(e) => setField("expectedLaunchDate", e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              max={new Date(new Date().setFullYear(new Date().getFullYear() + 10)).toISOString().split("T")[0]}
            />
            {submitted && errors.expectedLaunchDate && (
              <p style={{ color: "#d32f2f", fontSize: 13 }}>
                {errors.expectedLaunchDate}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="text-center btn-group_application">
        <button
          type="button"
          className="btn btn-outline-blue btn-lg"
          onClick={onBack}
        >
          <i className="fa fa-arrow-left" /> Back to Curriculum
        </button>
        <button
          type="button"
          className="btn btn-orange btn-lg"
          onClick={handleContinue}
        >
          <i className="fa fa-arrow-right" /> Continue to Application Package
        </button>
      </div>
    </div>
  );
}