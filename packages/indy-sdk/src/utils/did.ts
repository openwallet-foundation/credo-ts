/**
 * Based on DidUtils implementation in Aries Framework .NET
 * @see: https://github.com/hyperledger/aries-framework-dotnet/blob/f90eaf9db8548f6fc831abea917e906201755763/src/Hyperledger.Aries/Utils/DidUtils.cs
 *
 * Some context about full verkeys versus abbreviated verkeys:
 *  A standard verkey is 32 bytes, and by default in Indy the DID is chosen as the first 16 bytes of that key, before base58 encoding.
 *  An abbreviated verkey replaces the first 16 bytes of the verkey with ~ when it matches the DID.
 *
 *  When a full verkey is used to register on the ledger, this is stored as a full verkey on the ledger and also returned from the ledger as a full verkey.
 *  The same applies to an abbreviated verkey. If an abbreviated verkey is used to register on the ledger, this is stored as an abbreviated verkey on the ledger and also returned from the ledger as an abbreviated verkey.
 *
 *  For this reason we need some methods to check whether verkeys are full or abbreviated, so we can align this with `indy.abbreviateVerkey`
 *
 *  Aries Framework .NET also abbreviates verkey before sending to ledger:
 *  https://github.com/hyperledger/aries-framework-dotnet/blob/f90eaf9db8548f6fc831abea917e906201755763/src/Hyperledger.Aries/Ledger/DefaultLedgerService.cs#L139-L147
 */

import { Buffer, TypedArrayEncoder } from '@aries-framework/core'

export const FULL_VERKEY_REGEX = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/
export const ABBREVIATED_VERKEY_REGEX = /^~[1-9A-HJ-NP-Za-km-z]{21,22}$/
export const DID_INDY_REGEX = /^did:indy:((?:[a-z][_a-z0-9-]*)(?::[a-z][_a-z0-9-]*)?):([1-9A-HJ-NP-Za-km-z]{21,22})$/

/**
 * Check whether the did is a self certifying did. If the verkey is abbreviated this method
 * will always return true. Make sure that the verkey you pass in this method belongs to the
 * did passed in
 *
 * @return Boolean indicating whether the did is self certifying
 */
export function isLegacySelfCertifiedDid(did: string, verkey: string): boolean {
  // If the verkey is Abbreviated, it means the full verkey
  // is the did + the verkey
  if (isAbbreviatedVerkey(verkey)) {
    return true
  }

  const didFromVerkey = legacyIndyDidFromPublicKeyBase58(verkey)

  if (didFromVerkey === did) {
    return true
  }

  return false
}

export function legacyIndyDidFromPublicKeyBase58(publicKeyBase58: string): string {
  const buffer = TypedArrayEncoder.fromBase58(publicKeyBase58)

  const did = TypedArrayEncoder.toBase58(buffer.slice(0, 16))

  return did
}

export function getFullVerkey(did: string, verkey: string) {
  if (isFullVerkey(verkey)) return verkey

  // Did could have did:xxx prefix, only take the last item after :
  const id = did.split(':').pop() ?? did
  // Verkey is prefixed with ~ if abbreviated
  const verkeyWithoutTilde = verkey.slice(1)

  // Create base58 encoded public key (32 bytes)
  return TypedArrayEncoder.toBase58(
    Buffer.concat([
      // Take did identifier (16 bytes)
      TypedArrayEncoder.fromBase58(id),
      // Concat the abbreviated verkey (16 bytes)
      TypedArrayEncoder.fromBase58(verkeyWithoutTilde),
    ])
  )
}

/**
 * Check a base58 encoded string against a regex expression to determine if it is a full valid verkey
 * @param verkey Base58 encoded string representation of a verkey
 * @return Boolean indicating if the string is a valid verkey
 */
export function isFullVerkey(verkey: string): boolean {
  return FULL_VERKEY_REGEX.test(verkey)
}

/**
 * Check a base58 encoded string against a regex expression to determine if it is a valid abbreviated verkey
 * @param verkey Base58 encoded string representation of an abbreviated verkey
 * @returns Boolean indicating if the string is a valid abbreviated verkey
 */
export function isAbbreviatedVerkey(verkey: string): boolean {
  return ABBREVIATED_VERKEY_REGEX.test(verkey)
}
