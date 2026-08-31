"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, type LoginState } from "./actions";

const initialState: LoginState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={pending} style={{ width: "100%" }}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useActionState(signIn, initialState);

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="brand">
          ELO <span>Payroll Association</span>
        </div>
        <h1>Admin sign in</h1>

        <form action={formAction}>
          {state.error && <div className="alert alert-error">{state.error}</div>}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          <SubmitButton />
        </form>
      </div>
    </div>
  );
}
