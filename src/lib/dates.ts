const TZ = "Europe/Lisbon";

const dateTime = new Intl.DateTimeFormat("pt-PT", {
  timeZone: TZ,
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const dayMonth = new Intl.DateTimeFormat("pt-PT", { timeZone: TZ, day: "2-digit", month: "2-digit" });
const hourMinute = new Intl.DateTimeFormat("pt-PT", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const monthYear = new Intl.DateTimeFormat("pt-PT", { timeZone: "UTC", month: "long", year: "numeric" });
const yearMonth = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" });
const relative = new Intl.RelativeTimeFormat("pt-PT", { numeric: "auto" });

export const EDITION_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function formatDateTime(d: Date): string {
  return dateTime.format(d);
}

export function formatSchedule(d: Date): string {
  return `${dayMonth.format(d)} às ${hourMinute.format(d)}`;
}

export function currentEdition(): string {
  return yearMonth.format(new Date());
}

export function editionLabel(edition: string): string {
  const label = monthYear.format(new Date(`${edition}-15T12:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

export function timeAgo(d: Date, now: Date = new Date()): string {
  const seconds = Math.round((d.getTime() - now.getTime()) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "agora mesmo";
}
