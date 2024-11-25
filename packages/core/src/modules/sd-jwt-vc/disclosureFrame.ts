type DisclosureFrame = {
  [key: string]: boolean | DisclosureFrame
}

export function buildDisclosureFrameFromPayload(input: Record<string, unknown>): DisclosureFrame | null {
  // Handle objects recursively
  const result: DisclosureFrame = {}

  // Base case: input is null or undefined
  if (input === null || input === undefined) {
    return result
  }

  for (const [key, value] of Object.entries(input)) {
    // Ignore non-value values
    if (value === null || value === undefined) continue

    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        // TODO: Array disclosure frames are not yet supported - treating entire array as disclosed
        result[key] = true
      } else {
        result[key] = buildDisclosureFrameFromPayload(value as Record<string, unknown>) ?? false
      }
    } else {
      // Handle primitive values
      result[key] = true
    }
  }

  return Object.keys(result).length > 0 ? result : null
}
