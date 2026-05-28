export function normalizeSearchText(value: string | null | undefined): string {
  return (value || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s@._-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getEditDistance(a: string, b: string, maxDistance: number): number {
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = current[0];

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost
      );
      current[j] = value;
      rowMin = Math.min(rowMin, value);
    }

    if (rowMin > maxDistance) return maxDistance + 1;
    previous = current;
  }

  return previous[b.length];
}

function maxDistanceForToken(token: string): number {
  if (token.length >= 8) return 2;
  if (token.length >= 4) return 1;
  return 0;
}

function tokenMatches(valueToken: string, queryToken: string): boolean {
  if (valueToken.includes(queryToken)) return true;

  const maxDistance = maxDistanceForToken(queryToken);
  if (!maxDistance) return false;

  const candidate = valueToken.slice(0, Math.max(queryToken.length, valueToken.length));
  return getEditDistance(candidate, queryToken, maxDistance) <= maxDistance;
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
  if (tokens.length === 0) return false;

  const valueTokens = normalizedValue.split(" ").filter(Boolean);
  const initials = valueTokens.map((token) => token[0]).join("");

  if (initials && compactQuery.length >= 2 && initials.startsWith(compactQuery)) return true;

  return tokens.every((token) =>
    valueTokens.some((valueToken) => tokenMatches(valueToken, token))
  );
}
