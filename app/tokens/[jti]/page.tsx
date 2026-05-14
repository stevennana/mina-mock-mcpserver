import { notFound } from "next/navigation";
import { AppNav } from "@/app/app-nav";
import { TokensManager } from "@/app/tokens/tokens-manager";
import { getOAuthIssuedTokenDetail, listOAuthIssuedTokens } from "@/lib/oauth/service";
import { OAuthIssuedTokenNotFoundError } from "@/lib/oauth/types";

export const dynamic = "force-dynamic";

export default async function TokenDetailPage({ params }: { params: Promise<{ jti: string }> }) {
  const { jti } = await params;
  const tokenData = await listOAuthIssuedTokens();
  let detail;
  try {
    detail = await getOAuthIssuedTokenDetail(decodeURIComponent(jti));
  } catch (error) {
    if (error instanceof OAuthIssuedTokenNotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <main className="shell app-shell">
      <AppNav current="tokens" />
      <header className="page-header">
        <div>
          <p className="eyebrow">OAuth bearer evidence</p>
          <h1>Token detail</h1>
          <p className="lede compact">
            Inspect claims, tool/resource/prompt permissions, expiry, and revocation state without redisplaying raw access tokens.
          </p>
        </div>
        <div className="summary-strip" aria-label="Issued token counts">
          <span><strong>{tokenData.active}</strong>Active</span>
          <span><strong>{tokenData.expired}</strong>Expired</span>
          <span><strong>{tokenData.revoked}</strong>Revoked</span>
        </div>
      </header>
      <TokensManager initialData={tokenData} initialDetail={detail} initialUpdatedAt={new Date().toISOString()} view="detail" />
    </main>
  );
}
