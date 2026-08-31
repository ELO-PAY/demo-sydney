import ContactForm from "./ContactForm";

export default function HomePage() {
  return (
    <>
      <header className="site-header">
        <div className="container">
          <div className="brand">
            ELO <span>Payroll Association</span>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="container">
          <h1>
            Payroll compliance, <em>handled properly.</em>
          </h1>
          <p>
            Compliance reviews, remediation, system reviews, and help buying the
            right payroll technology — for Australian employers who can&apos;t
            afford to get it wrong. Tell us what you need and we&apos;ll be in
            touch.
          </p>
        </div>
      </section>

      <section className="container form-wrap">
        <div className="card">
          <h2>Request a call</h2>
          <p className="sub">
            A real person reviews every inquiry. We usually respond the same
            business day.
          </p>
          <ContactForm />
        </div>
      </section>

      <p className="footnote">
        © ELO Payroll Association · Payroll consulting services
      </p>
    </>
  );
}
