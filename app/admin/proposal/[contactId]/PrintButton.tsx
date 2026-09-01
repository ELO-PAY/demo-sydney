"use client";

// Small client button so the (server-rendered) proposal can trigger the
// browser's print / save-as-PDF dialog. Hidden when printing.
export default function PrintButton() {
  return (
    <button type="button" className="btn proposal-print" onClick={() => window.print()}>
      Print / Save as PDF
    </button>
  );
}
