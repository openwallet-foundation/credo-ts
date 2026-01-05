import { Hasher } from '../crypto/hashes/Hasher'
import { CredoError } from '../error'
import { TypedArrayEncoder } from './TypedArrayEncoder'

/**
 * Verifies Subresource Integrity (SRI) metadata according to W3C specification.
 *
 * This class implements the verification logic for integrity metadata strings
 * as defined in the W3C Subresource Integrity specification.
 *
 * @see https://www.w3.org/TR/SRI/
 */
// biome-ignore lint/complexity/noStaticOnlyClass: no explanation
export class IntegrityVerifier {
  /**
   * Verifies the integrity of raw data against provided integrity metadata.
   *
   * @param data - The data to verify
   * @param integrityMetadata - The integrity metadata string (e.g., "sha256-...")
   * @throws {CredoError} if verification fails
   */
  public static verifyIntegrity(data: Uint8Array, integrityMetadata: string): void {
    const parsedMetadata = IntegrityVerifier.parseIntegrityMetadata(integrityMetadata)

    // If metadata is empty, no verification is required
    if (parsedMetadata.length === 0) {
      throw new CredoError(`Integrity check failed. Parsed integrity metadata is empty.`)
    }

    // Get the strongest algorithm's metadata
    const strongestMetadata = IntegrityVerifier.getStrongestMetadata(parsedMetadata)

    // Try to match any of the strongest hashes
    for (const metadata of strongestMetadata) {
      const actualValue = IntegrityVerifier.applyAlgorithmToBytes(data, metadata.alg)
      if (actualValue === metadata.val) {
        return
      }
    }

    throw new CredoError(
      `Integrity check failed. None of the provided hashes match the computed hash for the response.`
    )
  }

  /**
   * Parses integrity metadata string into structured format.
   *
   * @param metadata - The integrity metadata string
   * @returns Array of parsed metadata objects
   */
  private static parseIntegrityMetadata(metadata: string): Array<{ alg: string; val: string }> {
    const result: Array<{ alg: string; val: string }> = []
    const validAlgorithms = ['sha256', 'sha384', 'sha512']

    // Split by whitespace
    const items = metadata.trim().split(/\s+/)

    for (const item of items) {
      if (!item) continue

      // Remove options (anything after '?')
      const [algorithmExpression] = item.split('?')

      // Split algorithm and base64 value
      const parts = algorithmExpression.split('-')
      if (parts.length < 2) continue

      const algorithm = parts[0].toLowerCase()
      const base64Value = parts.slice(1).join('-') // Rejoin in case base64 contains hyphens

      // Only include supported algorithms
      if (validAlgorithms.includes(algorithm)) {
        result.push({ alg: algorithm, val: base64Value })
      }
    }

    return result
  }

  /**
   * Returns the metadata for the strongest algorithm(s) in the set.
   *
   * @param metadataSet - Array of parsed metadata
   * @returns Array containing only the strongest algorithm's metadata
   */
  private static getStrongestMetadata(
    metadataSet: Array<{ alg: string; val: string }>
  ): Array<{ alg: string; val: string }> {
    if (metadataSet.length === 0) {
      return []
    }

    // Algorithm priority (higher = stronger)
    const algorithmPriority: Record<string, number> = {
      sha256: 0,
      sha384: 1,
      sha512: 2,
    }

    let strongest: { alg: string; val: string } | null = null
    const result: Array<{ alg: string; val: string }> = []

    for (const item of metadataSet) {
      if (!strongest) {
        strongest = item
        result.push(item)
        continue
      }

      const currentIndex = algorithmPriority[strongest.alg]
      const newIndex = algorithmPriority[item.alg]

      if (newIndex > currentIndex) {
        // Found a stronger algorithm, replace all
        strongest = item
        result.length = 0
        result.push(item)
      } else if (newIndex === currentIndex) {
        // Same strength, add to results
        result.push(item)
      }
      // If newIndex < currentIndex, ignore (weaker algorithm)
    }

    return result
  }

  /**
   * Applies the specified hash algorithm to the given bytes.
   *
   * @param bytes - The bytes to hash
   * @param algorithm - The hash algorithm name
   * @returns Base64-encoded hash value
   */
  private static applyAlgorithmToBytes(bytes: Uint8Array, algorithm: string): string {
    let hashResult: Uint8Array

    switch (algorithm) {
      case 'sha256':
        hashResult = Hasher.hash(bytes, 'sha-256')
        break
      case 'sha384':
        hashResult = Hasher.hash(bytes, 'sha-384')
        break
      case 'sha512':
        hashResult = Hasher.hash(bytes, 'sha-512')
        break
      default:
        throw new CredoError(`Unsupported hash algorithm: ${algorithm}`)
    }

    return TypedArrayEncoder.toBase64(hashResult)
  }
}
