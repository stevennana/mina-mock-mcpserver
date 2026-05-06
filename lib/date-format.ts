const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "UTC",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

export function formatShortDate(value: string | Date) {
  return shortDateFormatter.format(new Date(value));
}

export function formatDateTime(value: string | Date | null) {
  return value ? dateTimeFormatter.format(new Date(value)) : "Not set";
}
