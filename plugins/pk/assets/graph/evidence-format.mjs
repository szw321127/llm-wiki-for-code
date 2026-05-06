export const EVIDENCE_PREVIEW_LIMIT = 5;

export function normalizeEvidenceValue(value) {
  return String(value || "").trim().replace(/\\/g, "/");
}

export function isPathLikeEvidence(value) {
  const normalized = normalizeEvidenceValue(value);
  if (!normalized) {
    return false;
  }

  return normalized.includes("/") || /^[A-Za-z]:\//.test(normalized);
}

export function shortenEvidencePath(
  value,
  { segmentLimit = 6, maxLength = 72 } = {}
) {
  const normalized = normalizeEvidenceValue(value);
  if (!normalized) {
    return "";
  }

  const segments = normalized.split("/").filter(Boolean);
  let shortened = normalized;

  if (segments.length > segmentLimit) {
    shortened = `.../${segments.slice(-segmentLimit).join("/")}`;
  }

  if (shortened.length <= maxLength) {
    return shortened;
  }

  return `...${shortened.slice(-(maxLength - 3))}`;
}

export function buildEvidencePreview(
  values,
  { limit = EVIDENCE_PREVIEW_LIMIT } = {}
) {
  const items = (values || [])
    .map((value) => normalizeEvidenceValue(value))
    .filter(Boolean)
    .map((full) => ({
      full,
      pathLike: isPathLikeEvidence(full),
      display: isPathLikeEvidence(full) ? shortenEvidencePath(full) : full
    }));

  const visibleItems = items.slice(0, limit);
  const hiddenItems = items.slice(limit);

  return {
    visibleItems,
    hiddenItems,
    hiddenCount: hiddenItems.length
  };
}
