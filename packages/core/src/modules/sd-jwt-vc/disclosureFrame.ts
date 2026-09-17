import {
  createHashMappingSync,
  decodeSdJwtSync,
  getClaimsSync,
  getSDAlgAndPayload,
  SD_DIGEST,
  SD_LIST_KEY,
  selectDisclosures,
} from '@sd-jwt/core'
import { isObject } from 'class-validator'
import { Hasher } from '../../crypto'
import type { JsonObject } from '../../types'
import { SdJwtVcError } from './SdJwtVcError'

type DisclosureFrame = {
  [key: string]: boolean | DisclosureFrame
}

/**
 * @deprecated use `buildPresentationFrameForPaths` instead
 */
export function buildDisclosureFrameForPayload(input: JsonObject): DisclosureFrame {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      // TODO: Array disclosure frames are not yet supported - treating entire array as disclosed
      if (Array.isArray(value)) {
        return [key, true]
      }
      if (isObject(value)) {
        if (Object.keys.length === 0) return [key, false]
        return [key, buildDisclosureFrameForPayload(value)]
      }
      return [key, true]
    })
  )
}

/**
 * @deprecated use `applyDisclosuresForPaths` instead
 */
export function applyDisclosuresForPayload(compactSdJwt: string, requestedPayload: JsonObject) {
  const decoded = decodeSdJwtSync(compactSdJwt, Hasher.hash)
  const presentationFrame = buildDisclosureFrameForPayload(requestedPayload) ?? {}

  if (decoded.kbJwt) {
    throw new SdJwtVcError('Cannot apply limit disclosure on an sd-jwt with key binding jwt')
  }

  const requiredDisclosures = selectDisclosures(
    decoded.jwt.payload,
    // Map to sd-jwt disclosure format
    decoded.disclosures.map((d) => ({
      digest: d.digestSync({ alg: 'sha-256', hasher: Hasher.hash }),
      encoded: d.encode(),
      key: d.key,
      salt: d.salt,
      value: d.value,
    })),
    presentationFrame as { [key: string]: boolean }
  )
  const [jwt] = compactSdJwt.split('~')
  const disclosuresString =
    requiredDisclosures.length > 0 ? `${requiredDisclosures.map((d) => d.encoded).join('~')}~` : ''
  const sdJwt = `${jwt}~${disclosuresString}`
  return sdJwt
}

/**
 * The path to a claim, with property names for objects and element positions for arrays.
 *
 * An element has the position it has in the claims of the SD-JWT, as DCQL gives it. Decoy digests in an
 * array are not elements, and have no position.
 *
 * A path stands for the claim and everything below it, as a claims path does in DCQL.
 */
export type ClaimPath = Array<string | number>

/**
 * The paths to the claims a DCQL claim set selects, from the paths of its claims queries and its output.
 *
 * A claims query path stands for the claim and everything below it, so it gives a single path however
 * much is below the claim. A `null` in the path selects the array elements that matched, which are the
 * ones the output holds: for an element that did not match, DCQL leaves `null` in the output of a claims
 * query, and `undefined` or nothing in the output of a claim set.
 *
 * The output of a claim set merges the output of its claims queries, so an element can be in it for
 * another claims query of the claim set. Its path is then selected by that claims query anyway.
 */
export function getClaimPathsForDcqlClaimSet(
  claimsQueryPaths: Array<Array<string | number | null>>,
  output: unknown
): ClaimPath[] {
  const getPaths = (queryPath: Array<string | number | null>, value: unknown, path: ClaimPath): ClaimPath[] => {
    // FIXME: logic should be updated once this PR is released:
    // https://github.com/openwallet-foundation-labs/identity-common-ts/pull/261
    // DCQL leaves `null`, `undefined` or nothing where no claim is selected
    if (value === null || value === undefined) return []
    // The end of the query path selects the claim with everything below it
    if (queryPath.length === 0) return [path]

    const [pathElement, ...rest] = queryPath

    // `null` goes into every element of an array, and a position into one
    if (pathElement === null || typeof pathElement === 'number') {
      if (!Array.isArray(value)) return []
      if (pathElement !== null) return getPaths(rest, value[pathElement], [...path, pathElement])
      return value.flatMap((item, index) => getPaths(rest, item, [...path, index]))
    }

    // A property name goes into the claim of an object
    if (!isObject(value)) return []
    return getPaths(rest, (value as Record<string, unknown>)[pathElement], [...path, pathElement])
  }

  return claimsQueryPaths.flatMap((queryPath) => getPaths(queryPath, output, []))
}

/**
 * Builds the presentation frame that discloses the claims at the given paths of an SD-JWT, including
 * everything below them.
 *
 * Unlike {@link buildDisclosureFrameForPayload}, array elements are selected by their position, so an
 * element that is selectively disclosable on its own is disclosed when a path selects it, and only then.
 */
export function buildPresentationFrameForPaths(compactSdJwt: string, paths: ClaimPath[]): DisclosureFrame {
  const { payload, disclosuresByDigest } = decodeForPaths(compactSdJwt)
  // Only the frame is needed, the digests are for applyDisclosuresForPaths
  return selectClaimsAtPaths(payload, disclosuresByDigest, paths).frame
}

/**
 * Discloses the claims at the given paths of an SD-JWT, including everything below them.
 *
 * Besides the compact SD-JWT holding only the disclosures for those claims, returns what it discloses:
 * - `prettyClaims`, the claims as a verifier receives them.
 * - `disclosedPaths`, the paths to the claims it discloses. These are not only the given paths: a
 *   claim that is not selectively disclosable is always disclosed. A claim that is disclosed with
 *   everything below it has a single path, so a path only goes deeper where something below it is not
 *   disclosed. And unlike in the pretty claims, where an element that is not disclosed is left out,
 *   an array element has the position it has in the credential.
 */
export function applyDisclosuresForPaths(
  compactSdJwt: string,
  paths: ClaimPath[]
): { compact: string; prettyClaims: JsonObject; disclosedPaths: ClaimPath[] } {
  const { signedPayload, payload, disclosures, disclosuresByDigest, hasher } = decodeForPaths(compactSdJwt)
  // Find the digests of the disclosures needed for the paths
  const { digests } = selectClaimsAtPaths(payload, disclosuresByDigest, paths)

  // Keep only those disclosures, in the order of the SD-JWT
  const selectedDisclosures = disclosures.filter((disclosure) => digests.has(disclosure.digestSync(hasher)))
  const [jwt] = compactSdJwt.split('~')

  // Before getClaimsSync, which replaces the `_sd` in the values of nested disclosures with their claims
  const disclosedPaths = getDisclosedClaimPaths(payload, disclosuresByDigest, digests)

  // Rebuild the SD-JWT and its claims from the selected disclosures
  return {
    compact: `${jwt}~${selectedDisclosures.map((disclosure) => `${disclosure.encode()}~`).join('')}`,
    prettyClaims: getClaimsSync(signedPayload, selectedDisclosures, Hasher.hash) as JsonObject,
    disclosedPaths,
  }
}

function decodeForPaths(compactSdJwt: string) {
  const decoded = decodeSdJwtSync(compactSdJwt, Hasher.hash)

  if (decoded.kbJwt) {
    throw new SdJwtVcError('Cannot apply limit disclosure on an sd-jwt with key binding jwt')
  }

  // Split off `_sd_alg`, so it is not taken for a claim
  const { _sd_alg: alg, payload } = getSDAlgAndPayload(decoded.jwt.payload)
  const hasher = { alg, hasher: Hasher.hash }

  return {
    // With `_sd_alg`, which the functions of @sd-jwt/core read the hash algorithm from
    signedPayload: decoded.jwt.payload,
    payload,
    hasher,
    disclosures: decoded.disclosures,
    // To look up the disclosure for a digest in the payload
    disclosuresByDigest: createHashMappingSync(decoded.disclosures, hasher),
  }
}

type DisclosuresByDigest = ReturnType<typeof createHashMappingSync>

/**
 * A claim directly below a value of a signed SD-JWT payload.
 *
 * `key` is the property name or element position of the claim, and `frameKey` the one to use in a
 * presentation frame. These differ for an array element after a decoy digest: its position leaves out
 * the decoys, as in the claims of the SD-JWT, while @sd-jwt/core counts them in a presentation frame.
 */
interface ClaimBelow {
  key: string | number
  frameKey: string | number
  value: unknown
  // The digest of the disclosure, for a selectively disclosable claim
  digest?: string
}

/**
 * The claims directly below a value of a signed SD-JWT payload, or `undefined` for a value that is not
 * an object or array. A digest without a disclosure is a decoy, and not a claim.
 */
function getClaimsBelow(value: unknown, disclosuresByDigest: DisclosuresByDigest): ClaimBelow[] | undefined {
  if (Array.isArray(value)) {
    const claims: ClaimBelow[] = []

    // `frameKey` counts every element, `key` (the length so far) only the claims
    value.forEach((item, frameKey) => {
      // An element is a digest when it is an object with `...`, which @sd-jwt/core checks is a string
      const digest = isObject(item) ? (item as Record<string, string | undefined>)[SD_LIST_KEY] : undefined
      // A plain element is a claim that is always disclosed
      if (digest === undefined) {
        claims.push({ key: claims.length, frameKey, value: item })
        return
      }

      // A digest is a selectively disclosable element, or a decoy when it has no disclosure
      const disclosure = disclosuresByDigest[digest]
      if (disclosure) claims.push({ key: claims.length, frameKey, value: disclosure.value, digest })
    })

    return claims
  }

  if (isObject(value)) {
    const { [SD_DIGEST]: digests, ...claims } = value as Record<string, unknown>

    return [
      // The properties next to `_sd` are always disclosed
      ...Object.entries(claims).map(([key, claim]) => ({ key, frameKey: key, value: claim })),
      // The digests in `_sd` are selectively disclosable properties, or decoys when they have no disclosure
      ...((digests as string[] | undefined) ?? []).flatMap((digest) => {
        const disclosure = disclosuresByDigest[digest]
        if (!disclosure?.key) return []

        return [{ key: disclosure.key, frameKey: disclosure.key, value: disclosure.value, digest }]
      }),
    ]
  }

  return undefined
}

/**
 * The disclosures, and the presentation frame, for the claims at the given paths and everything below
 * them. A selectively disclosable claim on the way to a path is disclosed as well, as the claim below
 * it is not reachable otherwise, but only when there is a claim at the path.
 */
function selectClaimsAtPaths(payload: unknown, disclosuresByDigest: DisclosuresByDigest, paths: ClaimPath[]) {
  // A path as a string, to look it up in a set. A position stays a number, so it only selects an array element
  const toKey = (path: ClaimPath) => JSON.stringify(path)
  // The claims at the paths, which are disclosed with everything below them
  const selectedPaths = new Set(paths.map(toKey))
  // The claims above the paths, which are disclosed when there is a claim at a path below them
  const pathsOnTheWay = new Set(
    paths.flatMap((path) => path.slice(0, -1).map((_, index) => toKey(path.slice(0, index + 1))))
  )

  // Collects the digests of the disclosures to present, while building the frame
  const digests = new Set<string>()

  // The frame for the claims below a value, or `undefined` for a value that is not an object or array
  const select = (value: unknown, path: ClaimPath, isSelected: boolean): DisclosureFrame | undefined => {
    const claims = getClaimsBelow(value, disclosuresByDigest)
    // A value that is not an object or array has no frame, it is disclosed as `true`
    if (!claims) return undefined

    const frame: DisclosureFrame = {}

    for (const claim of claims) {
      const claimPath = [...path, claim.key]
      // A claim is selected when it is at a path, or below a selected claim
      const isClaimSelected = isSelected || selectedPaths.has(toKey(claimPath))
      // Skip claims that are neither selected nor on the way to a path
      if (!isClaimSelected && !pathsOnTheWay.has(toKey(claimPath))) continue

      // Go down first, to know whether a claim on the way leads to a claim at a path
      const claimFrame = select(claim.value, claimPath, isClaimSelected)
      // Nothing below a claim on the way is selected when there is no claim at the path
      if (!isClaimSelected && (!claimFrame || Object.keys(claimFrame).length === 0)) continue

      // Disclose the claim, and add it to the frame under the key @sd-jwt/core uses
      if (claim.digest) digests.add(claim.digest)
      frame[String(claim.frameKey)] = claimFrame ?? true
    }

    return frame
  }

  // An empty path selects the whole payload
  return { frame: select(payload, [], false) ?? {}, digests }
}

/**
 * The shortest paths to the claims of a signed SD-JWT payload that the given disclosures disclose: a
 * claim that is disclosed with everything below it has a single path. An object or array none of whose
 * claims is disclosed has no path.
 */
function getDisclosedClaimPaths(
  payload: unknown,
  disclosuresByDigest: DisclosuresByDigest,
  disclosedDigests: Set<string>
): ClaimPath[] {
  const getDisclosed = (value: unknown, path: ClaimPath): { paths: ClaimPath[]; isComplete: boolean } => {
    const claims = getClaimsBelow(value, disclosuresByDigest)
    // A value that is not an object or array is disclosed as a whole
    if (!claims) return { paths: [path], isComplete: true }

    // Go down into the claims that are disclosed: always, or by one of the digests
    const disclosed = claims
      .filter((claim) => !claim.digest || disclosedDigests.has(claim.digest))
      .map((claim) => getDisclosed(claim.value, [...path, claim.key]))

    // Complete when every claim below is disclosed, with everything below it
    const isComplete = disclosed.length === claims.length && disclosed.every((claim) => claim.isComplete)
    // A complete claim has a single path, except the payload, which has a path per claim
    if (isComplete && path.length > 0) return { paths: [path], isComplete }

    // Otherwise the paths of the disclosed claims below
    return { paths: disclosed.flatMap((claim) => claim.paths), isComplete }
  }

  return getDisclosed(payload, []).paths
}
