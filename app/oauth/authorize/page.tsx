import { redirect } from "next/navigation";
import { authorizationRequestToSearchParams, validateOAuthAuthorizeRequest } from "@/lib/oauth/service";
import { OAuthAuthorizeRequestError } from "@/lib/oauth/types";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function ErrorPanel({ error }: { error: OAuthAuthorizeRequestError }) {
  return (
    <main className="shell oauth-shell">
      <section className="oauth-panel" aria-labelledby="oauth-error-title">
        <p className="eyebrow">OAuth authorization</p>
        <h1 id="oauth-error-title">Authorization request failed</h1>
        <p className="form-message error">{error.message}</p>
        <dl className="oauth-detail-grid">
          <div>
            <dt>Error</dt>
            <dd>{error.code}</dd>
          </div>
          {error.field ? (
            <div>
              <dt>Field</dt>
              <dd>{error.field}</dd>
            </div>
          ) : null}
        </dl>
      </section>
    </main>
  );
}

export default async function OAuthAuthorizePage({ searchParams }: { searchParams: SearchParams }) {
  try {
    const context = await validateOAuthAuthorizeRequest(await searchParams);
    redirect(`/oauth/login?${authorizationRequestToSearchParams(context.request).toString()}`);
  } catch (error) {
    if (error instanceof OAuthAuthorizeRequestError) {
      return <ErrorPanel error={error} />;
    }
    throw error;
  }
}
