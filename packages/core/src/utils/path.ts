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
export function joinUriParts(parts: string[]) {
  let combined = ''

  for (const part of parts) {
    combined += part.endsWith('/') ? part : `${part}/`
  }

  return combined
}
