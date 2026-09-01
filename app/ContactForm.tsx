"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitInquiry, type FormState } from "./actions";
import { INQUIRY_TYPES, INDUSTRIES, URGENCY_LEVELS } from "@/lib/constants";

const initialState: FormState = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={pending}>
      {pending ? "Sending…" : "Request a call"}
    </button>
  );
}

export default function ContactForm() {
  const [state, formAction] = useActionState(submitInquiry, initialState);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate>
      {state.error && !state.fieldErrors && (
        <div className="alert alert-error">{state.error}</div>
      )}

      <div className="grid-2">
        <div className="field">
          <label htmlFor="name">
            Your name <span className="req">*</span>
          </label>
          <input id="name" name="name" type="text" autoComplete="name" required />
          {fe.name && <span className="req">{fe.name}</span>}
        </div>
        <div className="field">
          <label htmlFor="email">
            Email <span className="req">*</span>
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required />
          {fe.email && <span className="req">{fe.email}</span>}
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="phone">Phone</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" />
        </div>
        <div className="field">
          <label htmlFor="company">Company</label>
          <input id="company" name="company" type="text" autoComplete="organization" />
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="role">Your role</label>
          <input id="role" name="role" type="text" autoComplete="organization-title" />
        </div>
        <div className="field">
          <label htmlFor="type">
            What do you need help with? <span className="req">*</span>
          </label>
          <select id="type" name="type" defaultValue="" required>
            <option value="" disabled>
              Choose one…
            </option>
            {INQUIRY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {fe.type && <span className="req">{fe.type}</span>}
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="number_of_employees">Number of employees</label>
          <input
            id="number_of_employees"
            name="number_of_employees"
            type="text"
            placeholder="e.g. 250, or 'about 1,000'"
          />
        </div>
        <div className="field">
          <label htmlFor="current_industry">Industry</label>
          <select id="current_industry" name="current_industry" defaultValue="">
            <option value="">Prefer not to say</option>
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          {fe.current_industry && <span className="req">{fe.current_industry}</span>}
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="award">Award or industry instrument</label>
          <input
            id="award"
            name="award"
            type="text"
            placeholder="e.g. SCHADS, Retail Award, or 'not sure'"
          />
        </div>
        <div className="field">
          <label htmlFor="urgency">
            How urgent is this? <span className="req">*</span>
          </label>
          <select id="urgency" name="urgency" defaultValue="" required>
            <option value="" disabled>
              Choose one…
            </option>
            {URGENCY_LEVELS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
          {fe.urgency && <span className="req">{fe.urgency}</span>}
        </div>
      </div>

      <div className="field">
        <label htmlFor="ideal_project_start_date">Ideal project start date</label>
        <input
          id="ideal_project_start_date"
          name="ideal_project_start_date"
          type="date"
        />
        {fe.ideal_project_start_date && (
          <span className="req">{fe.ideal_project_start_date}</span>
        )}
      </div>

      <div className="field">
        <label htmlFor="message">How can we help?</label>
        <textarea
          id="message"
          name="message"
          placeholder="Tell us a little about your situation…"
        />
      </div>

      <div className="field checkbox">
        <input id="ok_to_contact" name="ok_to_contact" type="checkbox" />
        <label htmlFor="ok_to_contact">
          Keep me updated with occasional payroll compliance insights by email.
        </label>
      </div>

      <SubmitButton />
    </form>
  );
}
