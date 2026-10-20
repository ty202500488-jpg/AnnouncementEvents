import { useState } from "react";
import { Check } from "lucide-react";

export default function ProfileModal({ profile, onClose, onSave }) {
  const [firstName, setFirstName] = useState(profile?.firstName || "");
  const [lastName, setLastName] = useState(profile?.lastName || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ firstName, lastName });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h2>Your profile details</h2>

        <div className="profile-banner">
          <div className="avatar big">
            {[firstName, lastName].filter(Boolean).map((part) => part[0].toUpperCase()).join("")}
          </div>
          <div>
            <strong>{[firstName, lastName].filter(Boolean).join(" ")}</strong>
            <span>{profile?.email}</span>
          </div>
        </div>

        <div className="form-grid">
          <label>
            FIRST NAME
            <input value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={50} />
          </label>
          <label>
            LAST NAME
            <input value={lastName} onChange={(event) => setLastName(event.target.value)} maxLength={50} />
          </label>
          <label className="full">
            EMAIL ADDRESS
            <input value={profile?.email || ""} disabled />
          </label>
        </div>

        <div className="modal-actions">
          <button className="btn-text" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            className="btn-primary"
            onClick={save}
            disabled={saving || !firstName.trim() || !lastName.trim()}
          >
            <Check size={16} /> {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
