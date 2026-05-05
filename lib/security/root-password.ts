import { timingSafeEqual } from "node:crypto";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    timingSafeEqual(leftBuffer, leftBuffer);
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyRootPassword(candidate: string | null | undefined) {
  const configured = process.env.ROOT_PASSWORD;
  if (!configured || !candidate) {
    return false;
  }
  return safeEqual(candidate, configured);
}
