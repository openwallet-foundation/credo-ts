import { CredoError, JsonEncoder } from '@credo-ts/core'
import type { DidCommConnectionRecord } from '../modules/connections/repository'
import type { DidCommV2EncryptedMessage, DidCommV2SignedMessageWire } from '../v2/types'
import {
  DIDCOMM_V2_ENCRYPTED_MIME_TYPE,
  DIDCOMM_V2_KEY_WRAPPING_ALGORITHMS,
  DIDCOMM_V2_SIGNED_MIME_TYPE,
  normalizeDidCommMediaType,
} from '../v2/types'
import { isValidJweStructure } from './JWE'

/**
 * Canonical DIDComm protocol version identifier.
 *
 * DIDComm messaging is versioned along the major boundary only; minor
 * revisions are considered backwards-compatible within each major. Use this
 * type everywhere a version needs to be represented (connection records,
 * mediation records, module config, message metadata, etc.) instead of
 * redeclaring the `'v1' | 'v2'` union inline.
 */
export type DidCommVersion = 'v1' | 'v2'

/**
 * Detect whether an encrypted message is DIDComm v2 format: a JWE in General JSON Serialization with a
 * top-level recipients array, whose protected header uses a v2 key wrapping algorithm or the v2 media type.
 * The spec only says `typ` SHOULD be set, so a missing or different `typ` does not rule a message out.
 *
 * @param message - The message to check (typically a JWE object with protected, recipients, iv, ciphertext, tag)
 * @returns true if the message is DIDComm v2 encrypted format
 */
export function isDidCommV2EncryptedMessage(message: unknown): message is DidCommV2EncryptedMessage {
  if (!isValidJweStructure(message)) {
    return false
  }
  if (!Array.isArray((message as { recipients?: unknown }).recipients)) {
    return false
  }
  const protectedJson = decodeProtectedHeader((message as { protected: string }).protected)
  if (!protectedJson) return false
  if (typeof protectedJson.alg === 'string' && DIDCOMM_V2_KEY_WRAPPING_ALGORITHMS.includes(protectedJson.alg)) {
    return true
  }
  return hasMediaType(protectedJson, DIDCOMM_V2_ENCRYPTED_MIME_TYPE)
}

/**
 * Detect whether a message is a DIDComm v2 signed message, in the General or the Flattened JWS JSON
 * serialization. A signature is recognised by its protected `alg` or by the v2 signed media type. The
 * `typ` value is checked when the signature is verified, not here.
 *
 * @param message - The message to check
 * @returns true if the message is DIDComm v2 signed format
 */
export function isDidCommV2SignedMessage(message: unknown): message is DidCommV2SignedMessageWire {
  if (!message || typeof message !== 'object') return false
  const m = message as { payload?: unknown; signatures?: unknown }
  if (typeof m.payload !== 'string') return false
  if (m.signatures === undefined) return isDidCommV2JwsSignature(m)
  if (!Array.isArray(m.signatures) || m.signatures.length === 0) return false
  return m.signatures.every(isDidCommV2JwsSignature)
}

function isDidCommV2JwsSignature(signature: unknown): boolean {
  if (!signature || typeof signature !== 'object') return false
  const s = signature as { protected?: unknown; signature?: unknown }
  if (typeof s.protected !== 'string' || typeof s.signature !== 'string') return false
  const protectedJson = decodeProtectedHeader(s.protected)
  if (!protectedJson) return false
  return typeof protectedJson.alg === 'string' || hasMediaType(protectedJson, DIDCOMM_V2_SIGNED_MIME_TYPE)
}

function decodeProtectedHeader(encoded: string): { alg?: unknown; typ?: unknown } | undefined {
  try {
    const decoded = JsonEncoder.fromBase64Url(encoded)
    return decoded && typeof decoded === 'object' ? decoded : undefined
  } catch {
    return undefined
  }
}

function hasMediaType(protectedJson: { typ?: unknown }, mediaType: string): boolean {
  return typeof protectedJson.typ === 'string' && normalizeDidCommMediaType(protectedJson.typ) === mediaType
}

/**
 * Throws if the connection uses DIDComm v2. Use for protocols restricted to v1 (e.g. Message Pickup, Mediation).
 *
 * @param connection - The connection record to check
 * @param protocolName - Name of the protocol for the error message
 * @throws CredoError when connection.didcommVersion is 'v2'
 */
export function assertDidCommV1Connection(connection: DidCommConnectionRecord, protocolName: string): void {
  if ((connection.didcommVersion ?? 'v1') === 'v2') {
    throw new CredoError(
      `${protocolName} is restricted for DIDComm v2 connections. Use a v1 connection (handshake-based) instead.`
    )
  }
}

/**
 * Throws if the connection uses DIDComm v1. Use for protocols that require v2 (e.g. Coordinate Mediation 2.0, Message Pickup 4.0).
 *
 * @param connection - The connection record to check
 * @param protocolName - Name of the protocol for the error message
 * @throws CredoError when connection.didcommVersion is 'v1'
 */
export function assertDidCommV2Connection(connection: DidCommConnectionRecord, protocolName: string): void {
  if ((connection.didcommVersion ?? 'v1') === 'v1') {
    throw new CredoError(`${protocolName} requires a DIDComm v2 connection. Use a v2 connection instead.`)
  }
}
