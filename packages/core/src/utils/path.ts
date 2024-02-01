/**
 * Extract directory from path (should also work with windows paths)
 *
 * @param path the path to extract the directory from
 * @returns the directory path
 */
export function getDirFromFilePath(path: string) {
  return path.substring(0, Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')))
}

/**
 * Combine multiple uri parts into a single uri taking into account slashes.
 *
 * @param parts the parts to combine
 * @returns the combined url
 */
export function joinUriParts(base: string, parts: string[]) {
  if (parts.length === 0) return base

  // take base without trailing /
  let combined = base.trim()
  combined = base.endsWith('/') ? base.slice(0, base.length - 1) : base

  for (const part of parts) {
    // Remove leading and trailing /
    let strippedPart = part.trim()
    strippedPart = strippedPart.startsWith('/') ? strippedPart.slice(1) : strippedPart
    strippedPart = strippedPart.endsWith('/') ? strippedPart.slice(0, strippedPart.length - 1) : strippedPart

    // Don't want to add if empty
    if (strippedPart === '') continue

    combined += `/${strippedPart}`
  }

  return combined
}
