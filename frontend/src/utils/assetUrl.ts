export function resolveAssetUrl(value?: string | null): string | undefined {
  const rawValue = value?.trim();
  if (!rawValue || rawValue === "/default-avatar.png") return undefined;

  if (/^(https?:|data:|blob:)/i.test(rawValue)) {
    return rawValue;
  }

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  const appBase = apiBase.replace(/\/api\/?$/, "").replace(/\/$/, "");

  if (rawValue.startsWith("/uploads/")) {
    return appBase ? `${appBase}${rawValue}` : rawValue;
  }

  if (rawValue.startsWith("/")) {
    return rawValue;
  }
  const normalizedPath = rawValue.replace(/^\/+/, "");
  const uploadPath = normalizedPath.startsWith("uploads/")
    ? normalizedPath
    : `uploads/${normalizedPath}`;

  return appBase ? `${appBase}/${uploadPath}` : `/${uploadPath}`;
}
