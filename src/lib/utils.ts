export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
export function formatDate(d: string | Date) {
  try {
    return new Date(d).toLocaleString();
  } catch { return String(d); }
}
