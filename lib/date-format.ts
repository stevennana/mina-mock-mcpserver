function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function formatShortDate(value: string | Date) {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

export function formatDateTime(value: string | Date | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return [
    `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`,
    `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())} UTC`,
  ].join(" ");
}
