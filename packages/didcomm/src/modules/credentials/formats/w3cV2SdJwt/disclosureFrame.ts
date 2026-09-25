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
 * Splits a JSONPath claim path into its segments, normalizing array accessors.
 *
 * E.g. `$.credentialSubject.addresses[0].street` produces `['credentialSubject', 'addresses', '0', 'street']`
 */
function claimPathSegments(claimPath: string): string[] {
  // Strip leading "$." prefix
  const stripped = claimPath.startsWith('$.') ? claimPath.slice(2) : claimPath
  // Split on '.' and '[', normalizing "arr[0]" into ["arr", "0"]
  return stripped.split(/\.|\[|\]/).filter(Boolean)
}

/**
 * Resolves a JSONPath claim path against an object, reporting whether the claim is present.
 *
 * Presence is reported rather than the value alone, so that a claim explicitly set to `null` or a falsy
 * value is distinguished from a claim that is absent.
 */
export function resolveClaimPath(object: unknown, claimPath: string): { found: boolean; value?: unknown } {
  const segments = claimPathSegments(claimPath)
  if (segments.length === 0) return { found: false }

  let current: unknown = object
  for (const segment of segments) {
    if (current === null || typeof current !== 'object') return { found: false }

    const container = current as Record<string, unknown>
    if (!(segment in container)) return { found: false }

    current = container[segment]
  }

  return { found: true, value: current }
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
    const segments = claimPathSegments(path)
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
    if (!current._sd.includes(sdValue)) {
      current._sd.push(sdValue)
    }
  }

  return frame
}
