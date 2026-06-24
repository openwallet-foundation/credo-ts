import { CredoError, JsonEncoder } from '@credo-ts/core'
import type { DidCommConnectionRecord } from '../modules/connections/repository'
import type { DidCommV2EncryptedMessage, DidCommV2SignedMessage } from '../v2/types'
import { isValidJweStructure } from './JWE'

const DIDCOMM_V2_TYP = 'application/didcomm-encrypted+json'
const DIDCOMM_V2_SIGNED_TYP = 'application/didcomm-signed+json'
const DIDCOMM_V1_TYP = 'JWM/1.0'

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
 * Detect whether an encrypted message is DIDComm v2 format.
 * v2 uses typ: 'application/didcomm-encrypted+json' in the JWE protected header,
 * and JWE General JSON Serialization with a top-level recipients array.
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
  try {
    const protectedJson = JsonEncoder.fromBase64Url((message as { protected: string }).protected)
    return protectedJson?.typ === DIDCOMM_V2_TYP
  } catch {
    return false
  }
}

/**
 * Detect whether an encrypted message is DIDComm v2 authcrypt format.
 * Authcrypt uses ECDH-1PU+A256KW with skid present; sender is identifiable.
 *
 * @param message - The message to check (typically a JWE object with protected, iv, ciphertext, tag)
 * @returns true if the message is DIDComm v2 authcrypt format
 */
export function isDidCommV2AuthcryptMessage(message: unknown): boolean {
  if (!isValidJweStructure(message)) {
    return false
  }
  if (!Array.isArray((message as { recipients?: unknown }).recipients)) {
    return false
  }
  try {
    const protectedJson = JsonEncoder.fromBase64Url((message as { protected: string }).protected)
    return protectedJson?.typ === DIDCOMM_V2_TYP && typeof protectedJson?.skid === 'string'
  } catch {
    return false
  }
}

/**
 * Detect whether a message is a DIDComm v2 signed message (JWS general serialization).
 * v2 signed messages use typ: 'application/didcomm-signed+json' in each signature's protected header,
 * with `payload` (base64url JWM bytes) and `signatures` (array with per-signature kid in unprotected header) at the top level.
 *
 * @param message - The message to check
 * @returns true if the message is DIDComm v2 signed format
 */
export function isDidCommV2SignedMessage(message: unknown): message is DidCommV2SignedMessage {
  if (!message || typeof message !== 'object') return false
  const m = message as { payload?: unknown; signatures?: unknown }
  if (typeof m.payload !== 'string' || !Array.isArray(m.signatures) || m.signatures.length === 0) {
    return false
  }
  for (const sig of m.signatures) {
    if (!sig || typeof sig !== 'object') return false
    const s = sig as { protected?: unknown; signature?: unknown; header?: unknown }
    if (typeof s.protected !== 'string' || typeof s.signature !== 'string') return false
    try {
      const protectedJson = JsonEncoder.fromBase64Url(s.protected)
      if (protectedJson?.typ !== DIDCOMM_V2_SIGNED_TYP) return false
    } catch {
      return false
    }
  }
  return true
}

/**
 * Detect whether an encrypted message is DIDComm v1 format.
 * v1 uses typ: 'JWM/1.0' in the JWE protected header.
 *
 * @param message - The message to check (typically a JWE object with protected, iv, ciphertext, tag)
 * @returns true if the message is DIDComm v1 encrypted format
 */
export function isDidCommV1EncryptedMessage(message: unknown): boolean {
  if (!isValidJweStructure(message)) {
    return false
  }
  try {
    const protectedJson = JsonEncoder.fromBase64Url((message as { protected: string }).protected)
    return protectedJson?.typ === DIDCOMM_V1_TYP
  } catch {
    return false
  }
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
