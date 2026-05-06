import { AppNav } from "@/app/app-nav";
import { ResetForm } from "@/app/reset/reset-form";

export default function ResetPage() {
  return (
    <main className="shell app-shell">
      <AppNav current="reset" />
      <header className="page-header">
        <div>
          <p className="eyebrow">Operator recovery</p>
          <h1>Reset defaults</h1>
          <p className="lede compact">
            Root-protected reset for recovering the public test service to the current deterministic endpoint defaults.
          </p>
        </div>
      </header>

      <ResetForm />
    </main>
  );
}
