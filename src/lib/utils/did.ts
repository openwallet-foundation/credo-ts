// Based on DidUtils implementation in Aries Framework .NET
// see: https://github.com/hyperledger/aries-framework-dotnet/blob/f90eaf9db8548f6fc831abea917e906201755763/src/Hyperledger.Aries/Utils/DidUtils.cs

export const FULL_VERKEY_REGEX = /^[1-9A-HJ-NP-Za-km-z]{44}$/;
export const ABBREVIATED_VERKEY_REGEX = /^~[1-9A-HJ-NP-Za-km-z]{22}$/;
export const VERKEY_REGEX = new RegExp(`${FULL_VERKEY_REGEX.source}|${ABBREVIATED_VERKEY_REGEX.source}`);
export const DID_REGEX = /^did:([a-z]+):([a-zA-z\d]+)/;
export const DID_IDENTIFIER_REGEX = /^[a-zA-z\d-]+$/;

/**
 * Check a base58 encoded string against a regex expression to determine if it is a full valid verkey
 * @param verkey Base58 encoded string representation of a verkey
 * @return Boolean indicating if the string is a valid verkey
 */
export function isFullVerkey(verkey: string): boolean {
  return FULL_VERKEY_REGEX.test(verkey);
}

/**
 * Check a base58 encoded string against a regex expression to determine if it is a valid abbreviated verkey
 * @param verkey Base58 encoded string representation of an abbreviated verkey
 * @returns Boolean indicating if the string is a valid abbreviated verkey
 */
export function isAbbreviatedVerkey(verkey: string): boolean {
  return ABBREVIATED_VERKEY_REGEX.test(verkey);
}

/**
 * Check a base58 encoded string to determine if it is a valid verkey
 * @param verkey Base58 encoded string representation of a verkey
 * @returns Boolean indicating if the string is a valid verkey
 */
export function isVerkey(verkey: string): boolean {
  return VERKEY_REGEX.test(verkey);
}

/**
 * Check a string to determine if it is a valid did
 * @param did
 * @return Boolean indicating if the string is a valid did
 */
export function isDid(did: string): boolean {
  return DID_REGEX.test(did);
}

/**
 * Check a string to determine if it is a valid did identifier.
 * @param identifier Did identifier. This is a did without the did:method part
 * @return Boolean indicating if the string is a valid did identifier
 */
export function isDidIdentifier(identifier: string): boolean {
  return DID_IDENTIFIER_REGEX.test(identifier);
}
