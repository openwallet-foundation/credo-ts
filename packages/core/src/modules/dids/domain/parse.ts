import { parse } from 'did-resolver'
import { CredoError } from '../../../error'
import type { ParsedDid } from '../types'

export function parseDid(did: string): ParsedDid {
  const parsed = tryParseDid(did)

  if (!parsed) {
    throw new CredoError(`Error parsing did '${did}'`)
  }

  return parsed
}

export function tryParseDid(did: string): ParsedDid | null {
  return parse(did)
}

/**
 * Resolves a fragment-only relative DID URL (`#key-1`) against `did`, when `did` is a DID without path, query
 * or fragment and the result is a valid DID URL. Any other value is returned unchanged, so it never produces an
 * invalid DID URL. This is not general RFC 3986 reference resolution.
 */
export function toAbsoluteDidUrl(did: string, didUrl: string): string {
  return parseFragmentReference(didUrl, did)?.didUrl ?? didUrl
}

/** A reference to a DID, or to a verification method of a DID through its fragment */
export type DidReference = { kind: 'did'; did: string } | { kind: 'verificationMethod'; did: string; fragment: string }

/**
 * Parses a DID or DID URL with the strict DID Core parser (did-resolver `parse`).
 * - Resolves a relative fragment reference (`#key-1`) against `baseDid`, if it is a DID without path, query or
 *   fragment.
 * - Returns null for anything that is not a DID, has a path or a query, or has an empty fragment (`did:x#`).
 *   A query holds DID parameters (versionId, versionTime, service, ...) that select what to resolve or dereference,
 *   so a reference with a query is never treated as identifying a key. Credo doesn't yet treat one with a path
 *   as identifying a key either.
 */
export function parseDidReference(value: string, baseDid?: string): DidReference | null {
  const parsed = tryParseDid(value) ?? (baseDid ? parseFragmentReference(value, baseDid) : null)
  if (!parsed || parsed.path !== undefined || parsed.query !== undefined || parsed.fragment === '') return null

  return parsed.fragment === undefined
    ? { kind: 'did', did: parsed.did }
    : { kind: 'verificationMethod', did: parsed.did, fragment: parsed.fragment }
}

/**
 * True when both values parse, refer to the same DID, and either have the same fragment or both have none.
 * Relative references are resolved against `baseDid`. The DID and fragment are compared exactly, without
 * percent-decoding or case-folding.
 */
export function isSameDidReference(a: string, b: string, baseDid?: string): boolean {
  const referenceA = parseDidReference(a, baseDid)
  const referenceB = parseDidReference(b, baseDid)
  if (!referenceA || !referenceB) return false

  return (
    referenceA.did === referenceB.did &&
    (referenceA.kind === 'did'
      ? referenceB.kind === 'did'
      : referenceB.kind === 'verificationMethod' && referenceA.fragment === referenceB.fragment)
  )
}

/** Parses `value` as a fragment-only reference against `baseDid`, which must be a DID without path, query or fragment */
function parseFragmentReference(value: string, baseDid: string): ParsedDid | null {
  const parsedBaseDid = tryParseDid(baseDid)
  if (!parsedBaseDid || parsedBaseDid.didUrl !== parsedBaseDid.did || tryParseDid(value)) return null

  // Parsing the joined value lets the DID grammar decide what the fragment is. Checking the DID rejects a value
  // that would extend the base DID instead, such as `:456#k`
  const parsed = tryParseDid(`${baseDid}${value}`)
  const isFragmentOnly =
    parsed?.did === baseDid && parsed.path === undefined && parsed.query === undefined && parsed.fragment !== undefined
  return isFragmentOnly ? parsed : null
}
