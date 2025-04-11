import { encodeToBase58, decodeFromBase58 } from './base58'

/**
 * Note: When hashing JSON objects, you should first canonicalize the JSON using
 * the json-canonicalize package to ensure consistent hash generation:
 * 
 * ```
 * import { canonicalize } from 'json-canonicalize'
 * const jsonString = canonicalize(jsonObject)
 * const digestBuffer = createHash('sha256').update(jsonString).digest()
 * const multiHash = encodeMultihash(digestBuffer)
 * ```
 */

// Hash algorithm codes (from multiformats table)
const HASH_CODES: Record<string, number> = {
  sha256: 0x12,
  sha512: 0x13,
}

/**
 * Creates a multihash from a digest
 * @param digest The raw hash digest bytes
 * @param algorithm The hash algorithm used (defaults to sha256)
 * @returns A multihash encoded buffer
 */
export function createMultihash(digest: Buffer, algorithm = 'sha256'): Buffer {
  // Get the code for the hash algorithm
  const hashCode = HASH_CODES[algorithm]
  if (hashCode === undefined) {
    throw new Error(`Unsupported hash algorithm: ${algorithm}`)
  }

  // Length of the digest in bytes
  const digestLength = digest.length

  // Create a buffer for the multihash:
  // <hash-code><digest-length><digest>
  const multihashBuffer = Buffer.alloc(2 + digestLength)
  
  // Write hash code as varint (assuming it fits in a single byte for simplicity)
  multihashBuffer[0] = hashCode
  
  // Write length as varint (assuming it fits in a single byte for simplicity)
  multihashBuffer[1] = digestLength
  
  // Copy the digest into the buffer
  digest.copy(multihashBuffer, 2)
  
  return multihashBuffer
}

/**
 * Encodes a digest as a multihash string in base58 format
 * @param digest The raw hash digest bytes
 * @param algorithm The hash algorithm used (default sha256)
 * @returns A base58-encoded multihash string
 */
export function encodeMultihash(digest: Buffer, algorithm = 'sha256'): string {
  const multihashBuffer = createMultihash(digest, algorithm)
  return `z${encodeToBase58(multihashBuffer)}`
}

/**
 * Decodes a multihash string to extract the original digest
 * @param multihashString Base58-encoded multihash string
 * @returns The original digest buffer
 */
export function decodeMultihash(multihashString: string): { algorithm: string, digest: Buffer } {
  // Remove the 'z' prefix if present
  const base58String = multihashString.startsWith('z') ? multihashString.slice(1) : multihashString
  
  // Decode from base58
  const multihashBuffer = Buffer.from(decodeFromBase58(base58String))
  
  // Extract hash code, length, and digest
  const hashCode = multihashBuffer[0]
  const digestLength = multihashBuffer[1]
  const digest = multihashBuffer.slice(2, 2 + digestLength)
  
  // Get the algorithm name from the hash code
  const algorithm = Object.keys(HASH_CODES).find(key => HASH_CODES[key] === hashCode) || 'unknown'
  
  return { algorithm, digest }
} 