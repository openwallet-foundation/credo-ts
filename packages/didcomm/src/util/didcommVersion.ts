import { CredoError, JsonEncoder } from '@credo-ts/core'
import type { DidCommConnectionRecord } from '../modules/connections/repository'
import { isValidJweStructure } from './JWE'

const DIDCOMM_V2_TYP = 'application/didcomm-encrypted+json'
const DIDCOMM_V1_TYP = 'JWM/1.0'

/**
 * Detect whether an encrypted message is DIDComm v2 format.
 * v2 uses typ: 'application/didcomm-encrypted+json' in the JWE protected header.
 *
 * @param message - The message to check (typically a JWE object with protected, iv, ciphertext, tag)
 * @returns true if the message is DIDComm v2 encrypted format
 */
export function isDidCommV2EncryptedMessage(message: unknown): boolean {
  if (!isValidJweStructure(message)) {
    return false
  }
  try {
    const protectedJson = JsonEncoder.fromBase64((message as { protected: string }).protected)
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
  try {
    const protectedJson = JsonEncoder.fromBase64((message as { protected: string }).protected)
    return protectedJson?.typ === DIDCOMM_V2_TYP && typeof protectedJson?.skid === 'string'
  } catch {
    return false
  }
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
    const protectedJson = JsonEncoder.fromBase64((message as { protected: string }).protected)
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
export function assertDidCommV1Connection(
  connection: DidCommConnectionRecord,
  protocolName: string
): void {
  if ((connection.didcommVersion ?? 'v1') === 'v2') {
    throw new CredoError(
      `${protocolName} is restricted for DIDComm v2 connections. Use a v1 connection (handshake-based) instead.`
    )
  }
}
