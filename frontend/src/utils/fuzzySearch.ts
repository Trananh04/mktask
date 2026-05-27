export function normalizeSearchText(value: string | null | undefined): string {
  return (value || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s@._-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesSearchText(value: string | null | undefined, query: string): boolean {
  const normalizedValue = normalizeSearchText(value);
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) return true;
  if (normalizedValue.includes(normalizedQuery)) return true;

  const compactValue = normalizedValue.replace(/\s+/g, "");
  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  if (compactValue.includes(compactQuery)) return true;

  const tokens = normalizedQuery.split(" ").filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => normalizedValue.includes(token));
}
