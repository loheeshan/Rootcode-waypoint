"use client";

import Link from "next/link";
import "./modals/ReportsModal.css";

type ReportsModalProps = {
  onClose: () => void;
};

export default function ReportsModal({
  onClose,
}: ReportsModalProps) {
  return (
    <div className="reports-modal-overlay" onClick={onClose}>
      <div
        className="reports-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Reports"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="reports-item">
          <h3>Exceptions and audit log</h3>
          <p>
            Loading shortfalls, failed deliveries, pending Store receipts and the
            server audit history for the selected depot and date.
          </p>
        </div>

        <div className="reports-item">
          <h3>Plan revisions</h3>
          <p>
            Saved optimization revisions, deferral reasons and the published revision.
            CSV and PDF exports are not available from the API yet.
          </p>
        </div>

        <div className="reports-actions">
          <Link className="reports-primary" href="/dispatcher/trips#audit" onClick={onClose}>
            Open audit log →
          </Link>

          <Link href="/dispatcher/planning" onClick={onClose}>Plan revisions</Link>
        </div>

        <button className="reports-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
    </div>
  );
}
