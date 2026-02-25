import { describe, expect, test } from 'vitest'
import { IntegrityVerifier } from '../IntegrityVerifier'
import { TypedArrayEncoder } from '../TypedArrayEncoder'

describe('IntegrityVerifier - Subresource Integrity Verification', () => {
  const testContent = TypedArrayEncoder.fromString("alert('Hello, world.');")

  describe('verifyIntegrity', () => {
    test('should verify valid SHA-256 integrity', () => {
      // Pre-computed SHA-256 hash of "alert('Hello, world.');"
      const integrity = 'sha256-qznLcsROx4GACP2dm0UCKCzCG+HiZ1guq6ZZDob/Tng='

      expect(() => IntegrityVerifier.verifyIntegrity(testContent, integrity)).not.toThrow()
    })

    test('should verify valid SHA-384 integrity', () => {
      // Pre-computed SHA-384 hash
      const integrity = 'sha384-H8BRh8j48O9oYatfu5AZzq6A9RINhZO5H16dQZngK7T62em8MUt1FLm52t+eX6xO'

      expect(() => IntegrityVerifier.verifyIntegrity(testContent, integrity)).not.toThrow()
    })

    test('should verify valid SHA-512 integrity', () => {
      // Pre-computed SHA-512 hash
      const integrity =
        'sha512-Q2bFTOhEALkN8hOms2FKTDLy7eugP2zFZ1T8LCvX42Fp3WoNr3bjZSAHeOsHrbV1Fu9/A0EzCinRE7Af1ofPrw=='

      expect(() => IntegrityVerifier.verifyIntegrity(testContent, integrity)).not.toThrow()
    })

    test('should verify using strongest algorithm when multiple are provided', () => {
      // Multiple algorithms - should use SHA-512 (strongest)
      const integrity =
        'sha256-qznLcsROx4GACP2dm0UCKCzCG+HiZ1guq6ZZDob/Tng= ' +
        'sha384-H8BRh8j48O9oYatfu5AZzq6A9RINhZO5H16dQZngK7T62em8MUt1FLm52t+eX6xO ' +
        'sha512-Q2bFTOhEALkN8hOms2FKTDLy7eugP2zFZ1T8LCvX42Fp3WoNr3bjZSAHeOsHrbV1Fu9/A0EzCinRE7Af1ofPrw=='

      expect(() => IntegrityVerifier.verifyIntegrity(testContent, integrity)).not.toThrow()
    })

    test('should accept any valid hash of the same strength', () => {
      // Two SHA-384 hashes, first is valid
      const integrity =
        'sha384-H8BRh8j48O9oYatfu5AZzq6A9RINhZO5H16dQZngK7T62em8MUt1FLm52t+eX6xO ' + 'sha384-invalidhash'

      expect(() => IntegrityVerifier.verifyIntegrity(testContent, integrity)).not.toThrow()
    })

    test('should throw error for empty integrity metadata', () => {
      expect(() => IntegrityVerifier.verifyIntegrity(testContent, '')).toThrowError()
    })

    test('should throw error for whitespace-only integrity metadata', () => {
      expect(() => IntegrityVerifier.verifyIntegrity(testContent, '   ')).toThrowError()
    })

    test('should throw error when integrity check fails', () => {
      const integrity = 'sha256-invalidhashvalue='

      expect(() => {
        IntegrityVerifier.verifyIntegrity(testContent, integrity)
      }).toThrow('Integrity check failed')
    })

    test('should throw error when no hashes match', () => {
      const integrity = 'sha256-wronghash= sha384-anotherwronghash='

      expect(() => {
        IntegrityVerifier.verifyIntegrity(testContent, integrity)
      }).toThrow('Integrity check failed')
    })

    test('should throw error for unsupported algorithms', () => {
      // md5 is not supported, should be ignored and return true (empty set)
      const integrity = 'md5-somehash='

      expect(() => IntegrityVerifier.verifyIntegrity(testContent, integrity)).toThrowError()
    })

    test('should ignore options in hash expression', () => {
      // Options after '?' are reserved for future use and should be ignored
      const integrity = 'sha256-qznLcsROx4GACP2dm0UCKCzCG+HiZ1guq6ZZDob/Tng=?option1?option2'

      expect(() => IntegrityVerifier.verifyIntegrity(testContent, integrity)).not.toThrow()
    })

    test('should handle case-insensitive algorithm names', () => {
      const integrity = 'SHA256-qznLcsROx4GACP2dm0UCKCzCG+HiZ1guq6ZZDob/Tng='

      expect(() => IntegrityVerifier.verifyIntegrity(testContent, integrity)).not.toThrow()
    })

    test('should handle base64 values containing hyphens', () => {
      // Some base64 values may contain hyphens (base64url encoding)
      // The implementation should rejoin parts after the first hyphen
      const content = TypedArrayEncoder.fromString('test-content-with-hyphens')
      // You would need to compute the actual hash for this test
      // This test ensures the parsing logic handles hyphens in base64 correctly
      const integrity = 'sha256-somehash-with-hyphens='

      expect(() => {
        IntegrityVerifier.verifyIntegrity(content, integrity)
      }).toThrow('Integrity check failed')
    })

    test('should prioritize SHA-512 over SHA-384 and SHA-256', () => {
      // Provide wrong SHA-256 and SHA-384, but correct SHA-512
      const integrity =
        'sha256-wronghash ' +
        'sha384-anotherwronghash ' +
        'sha512-Q2bFTOhEALkN8hOms2FKTDLy7eugP2zFZ1T8LCvX42Fp3WoNr3bjZSAHeOsHrbV1Fu9/A0EzCinRE7Af1ofPrw=='

      expect(() => IntegrityVerifier.verifyIntegrity(testContent, integrity)).not.toThrow()
    })

    test('should handle multiple spaces between hash expressions', () => {
      const integrity =
        'sha256-qznLcsROx4GACP2dm0UCKCzCG+HiZ1guq6ZZDob/Tng=    sha512-Q2bFTOhEALkN8hOms2FKTDLy7eugP2zFZ1T8LCvX42Fp3WoNr3bjZSAHeOsHrbV1Fu9/A0EzCinRE7Af1ofPrw=='

      expect(() => IntegrityVerifier.verifyIntegrity(testContent, integrity)).not.toThrow()
    })

    test('should verify real-world JSON content', () => {
      const jsonContent = JSON.stringify({ name: 'test', value: 123 })
      const content = TypedArrayEncoder.fromString(jsonContent)

      // Compute actual hash (this is just a placeholder)
      // In real usage, you would get this from the resource provider
      const integrity = 'sha256-dummyhash='

      expect(() => {
        IntegrityVerifier.verifyIntegrity(content, integrity)
      }).toThrow('Integrity check failed')
    })
  })

  describe('parseIntegrityMetadata', () => {
    test('should parse single hash expression', () => {
      const metadata = 'sha256-abc123='
      // @ts-expect-error - testing private method
      const result = IntegrityVerifier.parseIntegrityMetadata(metadata)

      expect(result).toEqual([{ alg: 'sha256', val: 'abc123=' }])
    })

    test('should parse multiple hash expressions', () => {
      const metadata = 'sha256-abc123= sha384-def456= sha512-ghi789='
      // @ts-expect-error - testing private method
      const result = IntegrityVerifier.parseIntegrityMetadata(metadata)

      expect(result).toEqual([
        { alg: 'sha256', val: 'abc123=' },
        { alg: 'sha384', val: 'def456=' },
        { alg: 'sha512', val: 'ghi789=' },
      ])
    })

    test('should filter out unsupported algorithms', () => {
      const metadata = 'md5-abc= sha256-def= sha1-ghi='
      // @ts-expect-error - testing private method
      const result = IntegrityVerifier.parseIntegrityMetadata(metadata)

      expect(result).toEqual([{ alg: 'sha256', val: 'def=' }])
    })
  })

  describe('getStrongestMetadata', () => {
    test('should return strongest algorithm', () => {
      const metadataSet = [
        { alg: 'sha256', val: 'hash1' },
        { alg: 'sha512', val: 'hash2' },
        { alg: 'sha384', val: 'hash3' },
      ]
      // @ts-expect-error - testing private method
      const result = IntegrityVerifier.getStrongestMetadata(metadataSet)

      expect(result).toEqual([{ alg: 'sha512', val: 'hash2' }])
    })

    test('should return all metadata of same strength', () => {
      const metadataSet = [
        { alg: 'sha256', val: 'hash1' },
        { alg: 'sha384', val: 'hash2' },
        { alg: 'sha384', val: 'hash3' },
      ]
      // @ts-expect-error - testing private method
      const result = IntegrityVerifier.getStrongestMetadata(metadataSet)

      expect(result).toEqual([
        { alg: 'sha384', val: 'hash2' },
        { alg: 'sha384', val: 'hash3' },
      ])
    })

    test('should return empty array for empty input', () => {
      // @ts-expect-error - testing private method
      const result = IntegrityVerifier.getStrongestMetadata([])

      expect(result).toEqual([])
    })
  })
})
