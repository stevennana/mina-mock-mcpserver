import { expect, test } from "@playwright/test";
import { recordAuditEvent } from "@/lib/audit/service";

test.setTimeout(60_000);

test("audit log filters and incrementally loads records @ui-audit-log", async ({ page }) => {
  const prefix = `audit_bulk_${Date.now()}`;

  await Promise.all(
    Array.from({ length: 35 }, (_, index) =>
      recordAuditEvent({
        eventType: index % 2 === 0 ? "endpoint.delete" : "system.reset",
        subjectType: "endpoint",
        subjectId: `${prefix}_${index}`,
        subjectName: `${prefix}_${index}`,
        outcome: index % 3 === 0 ? "failure" : "success",
        metadata: { reason: index % 3 === 0 ? "bulk_failure" : "bulk_success", batch: prefix, index },
      }),
    ),
  );

  await page.goto("/audit");
  await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
  await page.getByLabel("Subject").fill(prefix);
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("25 shown, 35 matching")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: prefix })).toHaveCount(25);

  await page.getByRole("button", { name: "Load more records" }).click();
  await expect(page.getByText("35 shown, 35 matching")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: prefix })).toHaveCount(35);
  await page.screenshot({ path: "test-results/ui-audit-log-desktop.png", fullPage: true });

  await page.getByLabel("Outcome").selectOption("failure");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("12 shown, 12 matching")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "failure" })).toHaveCount(12);
  await expect(page.getByRole("row").filter({ hasText: "success" })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 900 });
  await expect(page.getByRole("heading", { name: "Records" })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBeFalsy();
  await page.screenshot({ path: "test-results/ui-audit-log-mobile.png", fullPage: true });
});
