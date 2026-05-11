"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { HelpTooltip } from "@/app/help-tooltip";
import { formatShortDate } from "@/lib/date-format";
import type { BasicUserListResult, BasicUserSummary } from "@/lib/basic-auth/types";

type FormState = {
  id?: string;
  username: string;
  password: string;
  enabled: boolean;
  builtIn: boolean;
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

const blankUser: FormState = {
  username: "",
  password: "",
  enabled: true,
  builtIn: false,
};

const BASIC_USER_FLASH_KEY = "mcp-mock-basic-user-flash";

function userToForm(user: BasicUserSummary): FormState {
  return {
    id: user.id,
    username: user.username,
    password: "",
    enabled: user.enabled,
    builtIn: user.builtIn,
  };
}

function errorFor(fieldErrors: Record<string, string>, field: string) {
  return fieldErrors[field] ? <p className="field-error">{fieldErrors[field]}</p> : null;
}

function FieldLabel({ label, help }: { label: string; help: string }) {
  return (
    <span className="field-label-row">
      {label}
      <HelpTooltip text={help} />
    </span>
  );
}

type BasicUserView = "catalog" | "detail" | "create";

export function BasicUsersManager({
  initialData,
  view = "catalog",
  initialSelectedId = null,
}: {
  initialData: BasicUserListResult;
  view?: BasicUserView;
  initialSelectedId?: string | null;
}) {
  const router = useRouter();
  const [listData, setListData] = useState(initialData);
  const [query, setQuery] = useState("");
  const initialUser = initialSelectedId ? initialData.users.find((user) => user.id === initialSelectedId) ?? null : null;
  const [form, setForm] = useState<FormState>(initialUser ? userToForm(initialUser) : blankUser);
  const [selectedId, setSelectedId] = useState<string | null>(initialUser?.id ?? null);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle", message: "", fieldErrors: {} });
  const [deleteState, setDeleteState] = useState<DeleteState>({ status: "idle", message: "" });

  useEffect(() => {
    if (!selectedId) return;
    const rawFlash = window.sessionStorage.getItem(BASIC_USER_FLASH_KEY);
    if (!rawFlash) return;
    try {
      const flash = JSON.parse(rawFlash) as { id?: string; message?: string };
      if (flash.id === selectedId && typeof flash.message === "string") {
        setSaveState({ status: "success", message: flash.message, fieldErrors: {} });
        window.sessionStorage.removeItem(BASIC_USER_FLASH_KEY);
      }
    } catch {
      window.sessionStorage.removeItem(BASIC_USER_FLASH_KEY);
    }
  }, [selectedId]);

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
    const response = await fetch("/api/basic-users");
    if (!response.ok) throw new Error("Unable to load Basic users.");
    setListData(await response.json());
  }

  function startCreate() {
    setForm(blankUser);
    setSelectedId(null);
    setSaveState({ status: "idle", message: "", fieldErrors: {} });
    setDeleteState({ status: "idle", message: "" });
  }

  async function saveUser() {
    setSaveState({ status: "saving", message: "Saving Basic user.", fieldErrors: {} });
    const isCreate = !selectedId;
    const target = selectedId ? `/api/basic-users/${selectedId}` : "/api/basic-users";
    const method = selectedId ? "PATCH" : "POST";
    const body = selectedId
      ? { password: form.password, enabled: form.enabled }
      : { username: form.username, password: form.password, enabled: form.enabled };

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

      const user = payload.user as BasicUserSummary;
      setForm(userToForm(user));
      setSelectedId(user.id);
      await refreshList();
      router.refresh();
      const successState: SaveState = { status: "success", message: "Basic user saved.", fieldErrors: {} };
      if (isCreate) {
        window.sessionStorage.setItem(BASIC_USER_FLASH_KEY, JSON.stringify({ id: user.id, message: successState.message }));
        router.push(`/basic-users/${user.id}`);
      }
      setSaveState(successState);
    } catch (error) {
      setSaveState({ status: "error", message: error instanceof Error ? error.message : "Save failed.", fieldErrors: {} });
    }
  }

  async function deleteSelectedUser() {
    if (!selectedId) return;

    setDeleteState({ status: "deleting", message: "Deleting Basic user." });
    try {
      const response = await fetch(`/api/basic-users/${selectedId}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) {
        setDeleteState({
          status: "error",
          message: typeof payload.message === "string" ? payload.message : "Basic user delete failed.",
        });
        return;
      }

      setForm(blankUser);
      setSelectedId(null);
      await refreshList();
      router.refresh();
      router.push("/basic-users");
      setSaveState({ status: "idle", message: "", fieldErrors: {} });
      setDeleteState({ status: "success", message: "Basic user deleted." });
    } catch (error) {
      setDeleteState({ status: "error", message: error instanceof Error ? error.message : "Basic user delete failed." });
    }
  }

  return (
    <div className={view === "catalog" ? "catalog-layout" : "focused-layout"}>
      {view === "catalog" ? (
      <section className="endpoint-list-panel" aria-labelledby="basic-user-list-title">
        <div className="section-heading-row">
          <div>
            <h2 id="basic-user-list-title">User catalog</h2>
            <p>{listData.total} Basic users, {listData.enabled} enabled</p>
          </div>
          <Link className="primary-button button-link" href="/basic-users/new">
            New Basic user
          </Link>
        </div>

        <label className="field-label" htmlFor="basic-user-search">Search</label>
        <input
          id="basic-user-search"
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
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <Link className="table-link" href={`/basic-users/${user.id}`}>
                      {user.username}
                    </Link>
                    <span>{user.builtIn ? "Built-in fixture" : "Managed test identity"}</span>
                  </td>
                  <td>
                    <span className={user.enabled ? "status-pill enabled" : "status-pill"}>{user.enabled ? "Enabled" : "Disabled"}</span>
                  </td>
                  <td>
                    <span className={user.builtIn ? "status-pill danger" : "status-pill"}>
                      {user.builtIn ? "Locked" : "Editable"}
                    </span>
                  </td>
                  <td>{formatShortDate(user.updatedAt)}</td>
                </tr>
              ))}
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty-cell">No Basic users match this search.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}

      {view !== "catalog" ? (
      <section className="endpoint-editor-panel" aria-labelledby="basic-user-editor-title">
        <div className="section-heading-row">
          <div>
            <h2 id="basic-user-editor-title">{selectedId ? "Edit Basic user" : "Create Basic user"}</h2>
            <p>{locked ? "Built-in default/default is permanent and locked." : "Passwords are stored only as hashes."}</p>
          </div>
          {locked ? <span className="status-pill danger">Locked fixture</span> : (
            <span className={form.enabled ? "status-pill enabled" : "status-pill"}>{form.enabled ? "Enabled" : "Disabled"}</span>
          )}
        </div>

        {saveState.message ? <p className={`form-message ${saveState.status}`}>{saveState.message}</p> : null}

        <div className="editor-section">
          <h3>Identity</h3>
          <div className="form-grid">
            <label className="field-block">
              <FieldLabel label="Username" help="Basic Auth username used by clients when calling strict Basic MCP or REST routes." />
              <input
                className="text-input"
                value={form.username}
                onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                disabled={Boolean(selectedId)}
              />
              {errorFor(saveState.fieldErrors, "username")}
            </label>
            <label className="field-block">
              <FieldLabel label={selectedId ? "New password" : "Password"} help="Stored as a hash only. Leave blank while editing to keep the existing password." />
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
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
                disabled={locked}
              />
              <span className="field-label-row">Enabled for Basic credential verification <HelpTooltip text="Disabled users remain visible in admin UI but fail Basic credential checks at runtime." /></span>
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
              Reset form
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
            The built-in default/default row is visible for testing but cannot be disabled, deleted, or assigned a new password.
          </p>
        </div>
      </section>
      ) : null}
    </div>
  );
}
