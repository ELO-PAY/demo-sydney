import Link from "next/link";

export default function ThankYouPage() {
  return (
    <div className="container center-screen">
      <div className="card">
        <div className="check">✓</div>
        <h1>Thank you — we&apos;ve got it.</h1>
        <p>
          Your inquiry has landed with the ELO Payroll Association team. A real
          person will review it and get back to you, usually the same business
          day.
        </p>
        <p style={{ marginBottom: 0 }}>
          <Link href="/">← Back to the site</Link>
        </p>
      </div>
    </div>
  );
}
