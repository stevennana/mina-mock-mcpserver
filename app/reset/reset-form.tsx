"use client";

import { FormEvent, useState } from "react";

type ResetState = {
  status: "idle" | "submitting" | "success" | "error";
  message: string;
};

export function ResetForm() {
  const [rootPassword, setRootPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [state, setState] = useState<ResetState>({ status: "idle", message: "" });

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "submitting", message: "Resetting defaults." });

    try {
      const response = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rootPassword, confirmation }),
      });
      const payload = (await response.json()) as { message?: string; result?: { seededEndpoints?: number } };

      if (!response.ok) {
        throw new Error(payload.message ?? "Reset failed.");
      }

      setRootPassword("");
      setConfirmation("");
      setState({
        status: "success",
        message: `Defaults restored. Seeded endpoints: ${payload.result?.seededEndpoints ?? 0}.`,
      });
    } catch (error) {
      setRootPassword("");
      setState({ status: "error", message: error instanceof Error ? error.message : "Reset failed." });
    }
  }

  return (
    <form className="reset-panel" onSubmit={(event) => void submitReset(event)}>
      <div>
        <h2>Reset service data</h2>
        <p>
          This clears currently implemented endpoint and test-user data, then recreates the deterministic seed defaults.
          Audit evidence is retained.
        </p>
      </div>

      {state.message ? <p className={`form-message ${state.status}`}>{state.message}</p> : null}

      <label className="field-block">
        <span>Root password</span>
        <input
          className="text-input"
          type="password"
          value={rootPassword}
          autoComplete="off"
          onChange={(event) => setRootPassword(event.target.value)}
        />
      </label>

      <label className="field-block">
        <span>Confirmation text</span>
        <input
          className="text-input"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          aria-describedby="reset-confirmation-hint"
        />
        <p className="field-hint" id="reset-confirmation-hint">
          Type RESET DEFAULTS exactly.
        </p>
      </label>

      <button className="danger-button" type="submit" disabled={state.status === "submitting"}>
        {state.status === "submitting" ? "Resetting" : "Reset to defaults"}
      </button>
    </form>
  );
}
