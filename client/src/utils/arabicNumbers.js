// Arabic-Indic digits (١٢) — what older Arabic readers expect.
export function ar(n) {
  return Number(n).toLocaleString('ar-EG', { useGrouping: false });
}
