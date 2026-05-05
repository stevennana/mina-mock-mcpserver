import { redirect } from "next/navigation";
import { authorizationRequestToSearchParams, loginOAuthUserForConsent, validateOAuthAuthorizeRequest } from "@/lib/oauth/service";
import { OAuthAuthorizeRequestError, OAuthLoginError } from "@/lib/oauth/types";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function hiddenAuthorizeInputs(context: Awaited<ReturnType<typeof validateOAuthAuthorizeRequest>>) {
  return (
    <>
      <input type="hidden" name="response_type" value={context.request.responseType} />
      <input type="hidden" name="client_id" value={context.request.clientId} />
      <input type="hidden" name="redirect_uri" value={context.request.redirectUri} />
      <input type="hidden" name="resource" value={context.request.resource} />
      {context.request.state ? <input type="hidden" name="state" value={context.request.state} /> : null}
    </>
  );
}

async function submitOAuthLogin(formData: FormData) {
  "use server";
  const authorizeRequest = {
    response_type: String(formData.get("response_type") ?? ""),
    client_id: String(formData.get("client_id") ?? ""),
    redirect_uri: String(formData.get("redirect_uri") ?? ""),
    resource: String(formData.get("resource") ?? ""),
    state: String(formData.get("state") ?? ""),
  };
  let target: string;
  try {
    const context = await loginOAuthUserForConsent({
      authorizeRequest,
      username: String(formData.get("username") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
    const params = authorizationRequestToSearchParams(context.request);
    params.set("login_ticket", context.loginTicket);
    target = `/oauth/consent?${params.toString()}`;
  } catch (error) {
    const params = new URLSearchParams(authorizeRequest);
    params.set(
      "login_error",
      error instanceof OAuthLoginError || error instanceof OAuthAuthorizeRequestError ? error.code : "login_failed",
    );
    target = `/oauth/login?${params.toString()}`;
  }
  redirect(target);
}

export default async function OAuthLoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  try {
    const context = await validateOAuthAuthorizeRequest(params);
    const loginError = typeof params.login_error === "string" ? params.login_error : "";
    return (
      <main className="shell oauth-shell">
        <section className="oauth-panel" aria-labelledby="oauth-login-title">
          <p className="eyebrow">Mock OAuth login</p>
          <h1 id="oauth-login-title">Sign in for consent</h1>
          <p className="lede compact">
            This login belongs to the mock OAuth authorization flow and is separate from the public admin UI.
          </p>
          <dl className="oauth-detail-grid" aria-label="Authorization request">
            <div>
              <dt>Client</dt>
              <dd>{context.client.displayName || context.client.clientId}</dd>
            </div>
            <div>
              <dt>Redirect URI</dt>
              <dd>{context.request.redirectUri}</dd>
            </div>
            <div>
              <dt>Resource</dt>
              <dd>{context.request.resource}</dd>
            </div>
            <div>
              <dt>Code TTL</dt>
              <dd>{context.codeTtlSeconds} seconds</dd>
            </div>
          </dl>
          {loginError ? <p className="form-message error">OAuth username or password is invalid.</p> : null}
          <form action={submitOAuthLogin} className="oauth-form">
            {hiddenAuthorizeInputs(context)}
            <label className="field-block">
              <span>Username</span>
              <input className="text-input" name="username" autoComplete="username" required />
            </label>
            <label className="field-block">
              <span>Password</span>
              <input className="text-input" name="password" type="password" autoComplete="current-password" required />
            </label>
            <button className="primary-button" type="submit">Continue</button>
          </form>
        </section>
      </main>
    );
  } catch (error) {
    if (error instanceof OAuthAuthorizeRequestError) {
      return (
        <main className="shell oauth-shell">
          <section className="oauth-panel" aria-labelledby="oauth-login-error-title">
            <p className="eyebrow">Mock OAuth login</p>
            <h1 id="oauth-login-error-title">Login unavailable</h1>
            <p className="form-message error">{error.message}</p>
          </section>
        </main>
      );
    }
    throw error;
  }
}
