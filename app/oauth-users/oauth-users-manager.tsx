"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatShortDate } from "@/lib/date-format";
import type { OAuthUserListResult, OAuthUserSummary } from "@/lib/oauth/types";

type FormState = {
  id?: string;
  username: string;
  password: string;
  enabled: boolean;
  builtIn: boolean;
  accessTokenTtlSeconds: number;
};

type SaveState = {
  status: "idle" | "saving" | "error" | "success";
  message: string;
  fieldErrors: Record<string, string>;
};

type DeleteState = {
  status: "idle" | "deleting" | "error" | "success";
  message: string;
};

const DEFAULT_TTL_SECONDS = 3600;

const blankUser: FormState = {
  username: "",
  password: "",
  enabled: true,
  builtIn: false,
  accessTokenTtlSeconds: DEFAULT_TTL_SECONDS,
};

function userToForm(user: OAuthUserSummary): FormState {
  return {
    id: user.id,
    username: user.username,
    password: "",
    enabled: user.enabled,
    builtIn: user.builtIn,
    accessTokenTtlSeconds: user.accessTokenTtlSeconds,
  };
}

function formatTtl(seconds: number) {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds % 3600 === 0) return `${seconds / 3600} hr`;
  return `${seconds} sec`;
}

function errorFor(fieldErrors: Record<string, string>, field: string) {
  return fieldErrors[field] ? <p className="field-error">{fieldErrors[field]}</p> : null;
}

export function OAuthUsersManager({ initialData }: { initialData: OAuthUserListResult }) {
  const router = useRouter();
  const [listData, setListData] = useState(initialData);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormState>(blankUser);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle", message: "", fieldErrors: {} });
  const [deleteState, setDeleteState] = useState<DeleteState>({ status: "idle", message: "" });

  const selectedUser = useMemo(
    () => listData.users.find((user) => user.id === selectedId) ?? null,
    [listData.users, selectedId],
  );
  const locked = Boolean(selectedUser?.builtIn || form.builtIn);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return listData.users;
    return listData.users.filter((user) => user.username.toLowerCase().includes(normalized));
  }, [listData.users, query]);

  async function refreshList() {
    const response = await fetch("/api/oauth-users");
    if (!response.ok) throw new Error("Unable to load OAuth users.");
    setListData(await response.json());
  }

  function startCreate() {
    setForm(blankUser);
    setSelectedId(null);
    setSaveState({ status: "idle", message: "", fieldErrors: {} });
    setDeleteState({ status: "idle", message: "" });
  }

  function selectUser(user: OAuthUserSummary) {
    setForm(userToForm(user));
    setSelectedId(user.id);
    setSaveState({ status: "idle", message: "", fieldErrors: {} });
    setDeleteState({ status: "idle", message: "" });
  }

  async function saveUser() {
    setSaveState({ status: "saving", message: "Saving OAuth user.", fieldErrors: {} });
    const target = selectedId ? `/api/oauth-users/${selectedId}` : "/api/oauth-users";
    const method = selectedId ? "PATCH" : "POST";
    const body = selectedId
      ? {
          password: form.password,
          enabled: form.enabled,
          accessTokenTtlSeconds: form.accessTokenTtlSeconds,
        }
      : {
          username: form.username,
          password: form.password,
          enabled: form.enabled,
          accessTokenTtlSeconds: form.accessTokenTtlSeconds,
        };

    try {
      const response = await fetch(target, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) {
        setSaveState({
          status: "error",
          message: typeof payload.message === "string" ? payload.message : "Fix the highlighted fields and save again.",
          fieldErrors: payload.fieldErrors ?? {},
        });
        return;
      }

      const user = payload.user as OAuthUserSummary;
      setForm(userToForm(user));
      setSelectedId(user.id);
      await refreshList();
      router.refresh();
      setSaveState({ status: "success", message: "OAuth user saved.", fieldErrors: {} });
    } catch (error) {
      setSaveState({ status: "error", message: error instanceof Error ? error.message : "Save failed.", fieldErrors: {} });
    }
  }

  async function deleteSelectedUser() {
    if (!selectedId) return;

    setDeleteState({ status: "deleting", message: "Deleting OAuth user." });
    try {
      const response = await fetch(`/api/oauth-users/${selectedId}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) {
        setDeleteState({
          status: "error",
          message: typeof payload.message === "string" ? payload.message : "OAuth user delete failed.",
        });
        return;
      }

      setForm(blankUser);
      setSelectedId(null);
      await refreshList();
      router.refresh();
      setSaveState({ status: "idle", message: "", fieldErrors: {} });
      setDeleteState({ status: "success", message: "OAuth user deleted." });
    } catch (error) {
      setDeleteState({ status: "error", message: error instanceof Error ? error.message : "OAuth user delete failed." });
    }
  }

  return (
    <div className="endpoint-layout">
      <section className="endpoint-list-panel" aria-labelledby="oauth-user-list-title">
        <div className="section-heading-row">
          <div>
            <h2 id="oauth-user-list-title">Login users</h2>
            <p>{listData.total} OAuth users, {listData.enabled} enabled</p>
          </div>
          <button className="primary-button" type="button" onClick={startCreate}>
            New OAuth user
          </button>
        </div>

        <label className="field-label" htmlFor="oauth-user-search">Search</label>
        <input
          id="oauth-user-search"
          className="text-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Username"
        />

        <div className="endpoint-table-shell" aria-live="polite">
          <table className="endpoint-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Status</th>
                <th>Lock</th>
                <th>Token TTL</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <button className="table-link" type="button" onClick={() => selectUser(user)}>
                      {user.username}
                    </button>
                    <span>{user.builtIn ? "Built-in login fixture" : "Managed login identity"}</span>
                  </td>
                  <td>
                    <span className={user.enabled ? "status-pill enabled" : "status-pill"}>{user.enabled ? "Enabled" : "Disabled"}</span>
                  </td>
                  <td>
                    <span className={user.builtIn ? "status-pill danger" : "status-pill"}>
                      {user.builtIn ? "Locked" : "Editable"}
                    </span>
                  </td>
                  <td>{formatTtl(user.accessTokenTtlSeconds)}</td>
                  <td>{formatShortDate(user.updatedAt)}</td>
                </tr>
              ))}
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-cell">No OAuth users match this search.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="endpoint-editor-panel" aria-labelledby="oauth-user-editor-title">
        <div className="section-heading-row">
          <div>
            <h2 id="oauth-user-editor-title">{selectedId ? "Edit OAuth user" : "Create OAuth user"}</h2>
            <p>{locked ? "Built-in default/default is permanent and locked." : "Passwords are stored only as hashes."}</p>
          </div>
          {locked ? <span className="status-pill danger">Locked fixture</span> : null}
        </div>

        {saveState.message ? <p className={`form-message ${saveState.status}`}>{saveState.message}</p> : null}

        <div className="editor-section">
          <h3>Identity</h3>
          <div className="form-grid">
            <label className="field-block">
              <span>Username</span>
              <input
                className="text-input"
                value={form.username}
                onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                disabled={Boolean(selectedId)}
              />
              {errorFor(saveState.fieldErrors, "username")}
            </label>
            <label className="field-block">
              <span>{selectedId ? "New password" : "Password"}</span>
              <input
                className="text-input"
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                disabled={locked}
                placeholder={selectedId ? "Leave blank to keep current hash" : ""}
              />
              {errorFor(saveState.fieldErrors, "password")}
            </label>
            <label className="field-block">
              <span>Authorization-code token TTL</span>
              <select
                className="text-input"
                value={form.accessTokenTtlSeconds}
                onChange={(event) =>
                  setForm((current) => ({ ...current, accessTokenTtlSeconds: Number(event.target.value) }))
                }
                disabled={locked}
              >
                {listData.ttlPresets.map((preset) => (
                  <option key={preset.seconds} value={preset.seconds}>{preset.label}</option>
                ))}
              </select>
              {errorFor(saveState.fieldErrors, "accessTokenTtlSeconds")}
            </label>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
                disabled={locked}
              />
              Enabled for OAuth login verification
            </label>
          </div>
        </div>

        <div className="editor-section">
          <h3>Actions</h3>
          <div className="console-actions">
            <button className="primary-button" type="button" onClick={() => void saveUser()} disabled={locked || saveState.status === "saving"}>
              Save
            </button>
            <button className="secondary-button" type="button" onClick={startCreate}>
              Clear
            </button>
            <button
              className="danger-button"
              type="button"
              onClick={() => void deleteSelectedUser()}
              disabled={!selectedId || locked || deleteState.status === "deleting"}
            >
              Delete
            </button>
          </div>
          {deleteState.message ? <p className={`form-message ${deleteState.status}`}>{deleteState.message}</p> : null}
          <p className="section-note">
            The built-in default/default row is visible for later login-flow testing but cannot be disabled, deleted, or assigned a new password.
          </p>
        </div>
      </section>
    </div>
  );
}
