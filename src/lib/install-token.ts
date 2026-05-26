/**
 * Extract the optional `install` URL param (used to re-establish an admin
 * session from a bookmarked PWA URL). Returns the value in the shape that
 * `requireAdminFn` expects.
 *
 * Used in admin route `beforeLoad`s. The token survives in the URL forever
 * (we intentionally don't strip it) so the bookmark keeps working when iOS
 * drops the standalone-PWA cookie jar.
 */
export function installTokenArgFromLocation(location: {
  search?: unknown;
  searchStr?: string;
}): { data: { installToken?: string } } {
  const search = location.search;
  if (search && typeof search === "object" && search !== null && "install" in search) {
    const v = (search as Record<string, unknown>).install;
    if (typeof v === "string" && v.length > 0) return { data: { installToken: v } };
  }
  // Fallback for routes without a search validator: parse the raw search string.
  if (typeof location.searchStr === "string" && location.searchStr.length > 0) {
    const params = new URLSearchParams(
      location.searchStr.startsWith("?") ? location.searchStr.slice(1) : location.searchStr,
    );
    const v = params.get("install");
    if (v) return { data: { installToken: v } };
  }
  return { data: {} };
}
