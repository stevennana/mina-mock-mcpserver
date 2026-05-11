import { redirect } from "next/navigation";
import {
  authorizationRequestToSearchParams,
  createOAuthAuthorizationCode,
  validateOAuthConsentRequest,
} from "@/lib/oauth/service";
import { OAuthAuthorizeRequestError, OAuthLoginError } from "@/lib/oauth/types";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function submitOAuthConsent(formData: FormData) {
  "use server";
  const authorizeRequest = {
    response_type: String(formData.get("response_type") ?? ""),
    client_id: String(formData.get("client_id") ?? ""),
    redirect_uri: String(formData.get("redirect_uri") ?? ""),
    resource: String(formData.get("resource") ?? ""),
    state: String(formData.get("state") ?? ""),
    code_challenge: String(formData.get("code_challenge") ?? ""),
    code_challenge_method: String(formData.get("code_challenge_method") ?? ""),
  };
  const loginTicket = String(formData.get("login_ticket") ?? "");
  let target: string;
  try {
    const code = await createOAuthAuthorizationCode({
      authorizeRequest,
      loginTicket,
      selectedEndpointIds: formData.getAll("endpoint_id").map(String),
    });
    const redirectUrl = new URL(code.redirectUri);
    redirectUrl.searchParams.set("code", code.code);
    if (code.state) redirectUrl.searchParams.set("state", code.state);
    target = redirectUrl.toString();
  } catch (error) {
    const params = authorizationRequestToSearchParams({
      responseType: authorizeRequest.response_type,
      clientId: authorizeRequest.client_id,
      redirectUri: authorizeRequest.redirect_uri,
      resource: authorizeRequest.resource,
      state: authorizeRequest.state || null,
      codeChallenge: authorizeRequest.code_challenge || null,
      codeChallengeMethod: authorizeRequest.code_challenge_method || null,
    });
    params.set("login_ticket", loginTicket);
    params.set(
      "consent_error",
      error instanceof OAuthLoginError || error instanceof OAuthAuthorizeRequestError ? error.code : "consent_failed",
    );
    target = `/oauth/consent?${params.toString()}`;
  }
  redirect(target);
}

export default async function OAuthConsentPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const loginTicket = typeof params.login_ticket === "string" ? params.login_ticket : "";
  try {
    const context = await validateOAuthConsentRequest({ authorizeRequest: params, loginTicket });
    const consentError = typeof params.consent_error === "string" ? params.consent_error : "";
    return (
      <main className="shell oauth-shell">
        <section className="oauth-panel" aria-labelledby="oauth-consent-title">
          <p className="eyebrow">Mock OAuth consent</p>
          <h1 id="oauth-consent-title">Approve endpoint access</h1>
          <dl className="oauth-detail-grid" aria-label="Consent details">
            <div>
              <dt>Client</dt>
              <dd>{context.client.displayName || context.client.clientId}</dd>
            </div>
            <div>
              <dt>User</dt>
              <dd>{context.user.username}</dd>
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
              <dt>Authorization code TTL</dt>
              <dd>{context.codeTtlSeconds} seconds</dd>
            </div>
          </dl>
          {consentError ? <p className="form-message error">Select at least one allowed endpoint permission.</p> : null}
          <form action={submitOAuthConsent} className="oauth-form">
            <input type="hidden" name="response_type" value={context.request.responseType} />
            <input type="hidden" name="client_id" value={context.request.clientId} />
            <input type="hidden" name="redirect_uri" value={context.request.redirectUri} />
            <input type="hidden" name="resource" value={context.request.resource} />
            <input type="hidden" name="login_ticket" value={context.loginTicket} />
            {context.request.state ? <input type="hidden" name="state" value={context.request.state} /> : null}
            {context.request.codeChallenge ? <input type="hidden" name="code_challenge" value={context.request.codeChallenge} /> : null}
            {context.request.codeChallengeMethod ? <input type="hidden" name="code_challenge_method" value={context.request.codeChallengeMethod} /> : null}
            <fieldset className="oauth-permissions">
              <legend>Endpoint permissions</legend>
              {context.client.allowedEndpoints.length ? (
                context.client.allowedEndpoints.map((endpoint) => (
                  <label className="compact-check endpoint-check" key={endpoint.id}>
                    <input type="checkbox" name="endpoint_id" value={endpoint.id} defaultChecked={endpoint.enabled} />
                    <span>
                      <strong>{endpoint.name}</strong>
                      {endpoint.title ? endpoint.title : "Untitled endpoint"}
                      {!endpoint.enabled ? " (disabled)" : ""}
                    </span>
                  </label>
                ))
              ) : (
                <p className="section-note">This client has no allowed endpoints configured.</p>
              )}
            </fieldset>
            <button className="primary-button" type="submit">Approve selected endpoints</button>
          </form>
        </section>
      </main>
    );
  } catch (error) {
    if (error instanceof OAuthAuthorizeRequestError || error instanceof OAuthLoginError) {
      return (
        <main className="shell oauth-shell">
          <section className="oauth-panel" aria-labelledby="oauth-consent-error-title">
            <p className="eyebrow">Mock OAuth consent</p>
            <h1 id="oauth-consent-error-title">Consent unavailable</h1>
            <p className="form-message error">{error.message}</p>
          </section>
        </main>
      );
    }
    throw error;
  }
}
