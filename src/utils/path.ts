/**
 * Extract directory from path (should also work with windows paths)
 *
 * @param path the path to extract the directory from
 * @returns the directory path
 */
export function getDirFromFilePath(path: string) {
  return path.substring(0, Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')))
}
