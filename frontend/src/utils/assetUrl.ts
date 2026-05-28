export function resolveAssetUrl(value?: string | null): string | undefined {
  const rawValue = value?.trim().replace(/\\/g, "/");
  if (!rawValue || rawValue === "/default-avatar.png") return undefined;

  if (/^(https?:|data:|blob:)/i.test(rawValue)) {
    return rawValue;
  }

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  const appBase = apiBase.replace(/\/api\/?$/, "").replace(/\/$/, "");

  if (rawValue.startsWith("/api/uploads/")) {
    const uploadPath = rawValue.replace(/^\/api/, "");
    return appBase ? `${appBase}${uploadPath}` : uploadPath;
  }

  if (rawValue.startsWith("/uploads/")) {
    return appBase ? `${appBase}${rawValue}` : rawValue;
  }

  if (rawValue.startsWith("/")) {
    return rawValue;
  }
  const normalizedPath = rawValue.replace(/^\/+/, "").replace(/^api\/uploads\//, "uploads/");
  const uploadPath = normalizedPath.startsWith("uploads/")
    ? normalizedPath
    : `uploads/${normalizedPath}`;

  return appBase ? `${appBase}/${uploadPath}` : `/${uploadPath}`;
}
