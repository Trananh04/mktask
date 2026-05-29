export function resolveAssetUrl(value?: string | null): string | undefined {
  const rawValue = value?.trim().replace(/\\/g, "/");
  if (!rawValue || rawValue === "/default-avatar.png") return undefined;

  if (/^(https?:|data:|blob:)/i.test(rawValue)) {
    return rawValue;
  }

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  // appBase = "http://localhost:3000"
  const appBase = apiBase.replace(/\/api\/?$/, "").replace(/\/$/, "");
  // apiPath = "/api"
  const apiPath = apiBase ? new URL(apiBase).pathname.replace(/\/$/, "") : "/api";

  if (rawValue.startsWith("/api/uploads/")) {
    // Already has /api/uploads/ prefix - just prepend host
    return appBase ? `${appBase}${rawValue}` : rawValue;
  }

  if (rawValue.startsWith("/uploads/")) {
    // Has /uploads/ but missing /api prefix
    return appBase ? `${appBase}${apiPath}${rawValue}` : `${apiPath}${rawValue}`;
  }

  if (rawValue.startsWith("/")) {
    return rawValue;
  }

  // Raw storage key e.g. "avatar/avatar_xxx.jpg"
  const normalizedPath = rawValue.replace(/^\/+/, "").replace(/^api\/uploads\//, "uploads/");
  const uploadPath = normalizedPath.startsWith("uploads/")
    ? normalizedPath
    : `uploads/${normalizedPath}`;

  // Must include /api prefix: http://localhost:3000/api/uploads/avatar/xxx.jpg
  return appBase ? `${appBase}${apiPath}/${uploadPath}` : `${apiPath}/${uploadPath}`;
}
