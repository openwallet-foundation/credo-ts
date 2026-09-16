import type { IDisclosureFrame } from '@credo-ts/core'

/**
 * Derives an array of JSONPath-like claim paths from an IDisclosureFrame.
 * These paths represent the claims that are selectively disclosable.
 *
 * E.g. `{ credentialSubject: { _sd: ["familyName"], result: { _sd: [0, 1] } } }`
 * produces: `["$.credentialSubject.familyName", "$.credentialSubject.result[0]", "$.credentialSubject.result[1]"]`
 */
export function claimPathsFromDisclosureFrame(frame: IDisclosureFrame): string[] {
  const paths: string[] = []
  collectPaths(frame, '$', paths)
  return paths
}

function collectPaths(frame: IDisclosureFrame, prefix: string, paths: string[]): void {
  for (const [key, value] of Object.entries(frame)) {
    if (key === '_sd' && Array.isArray(value)) {
      for (const claim of value) {
        if (typeof claim === 'number') {
          paths.push(`${prefix}[${claim}]`)
        } else {
          paths.push(`${prefix}.${claim}`)
        }
      }
    } else if (key === '_sd_decoy') {
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      collectPaths(value as IDisclosureFrame, `${prefix}.${key}`, paths)
    }
  }
}

/**
 * Derives an IDisclosureFrame from an array of JSONPath claim paths, the inverse of
 * {@link claimPathsFromDisclosureFrame}.
 *
 * E.g. `["$.credentialSubject.familyName", "$.credentialSubject.result[0]"]`
 * produces: `{ credentialSubject: { _sd: ["familyName"], result: { _sd: [0] } } }`
 */
export function disclosureFrameFromClaimPaths(claimPaths?: string[]): IDisclosureFrame | undefined {
  if (!claimPaths || claimPaths.length === 0) return undefined

  const frame: IDisclosureFrame = {}

  for (const path of claimPaths) {
    // Strip leading "$." prefix
    const stripped = path.startsWith('$.') ? path.slice(2) : path
    // Split on '.' and '[', normalizing "arr[0]" into ["arr", "0"]
    const segments = stripped.split(/\.|\[|\]/).filter(Boolean)
    if (segments.length === 0) continue

    // Walk/create nested frame objects for intermediate segments
    let current: IDisclosureFrame = frame
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]
      if (!current[segment] || typeof current[segment] !== 'object' || Array.isArray(current[segment])) {
        current[segment] = {} as IDisclosureFrame
      }
      current = current[segment] as IDisclosureFrame
    }

    // Add the last segment to _sd. Numeric indices must be numbers for array item disclosure.
    if (!current._sd) current._sd = []
    const claim = segments[segments.length - 1]
    const sdValue = /^\d+$/.test(claim) ? Number(claim) : claim
    if (!current._sd.includes(sdValue as string)) {
      current._sd.push(sdValue as string)
    }
  }

  return frame
}
