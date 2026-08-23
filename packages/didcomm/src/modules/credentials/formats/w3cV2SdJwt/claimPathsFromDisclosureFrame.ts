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
      continue
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      collectPaths(value as IDisclosureFrame, `${prefix}.${key}`, paths)
    }
  }
}
