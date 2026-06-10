import * as x509 from '@peculiar/x509'
import { CredoWebCrypto, CredoWebCryptoKey, publicJwkToCryptoKeyAlgorithm } from '../../crypto/webcrypto'
import { x509SignatureAlgorithmToJwa } from './utils'
import { X509Certificate } from './X509Certificate'
import { X509Error } from './X509Error'

export interface RevokedCertificate {
  serialNumber: string
  revocationDate: Date
  reason?: number
}

/**
 * Normalize a hexadecimal serial number for comparison by lowercasing and stripping leading
 * zeros, so that e.g. `0A1B2C` and `0a1b2c` are treated as equal.
 */
function normalizeSerialNumber(serialNumber: string): string {
  return serialNumber.toLowerCase().replace(/^0+/, '') || '0'
}

/**
 * Byte-for-byte equality of two `Uint8Array`s.
 */
function uint8ArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * Wrapper class for X.509 Certificate Revocation List (CRL)
 * Provides a clean interface over the @peculiar/x509 CRL implementation
 */
export class X509CertificateRevocationList {
  private crl: x509.X509Crl

  private constructor(crl: x509.X509Crl) {
    this.crl = crl
  }

  /**
   * Parse a CRL from raw bytes
   */
  public static fromRaw(rawCrl: Uint8Array): X509CertificateRevocationList {
    try {
      const crl = new x509.X509Crl(rawCrl)
      return new X509CertificateRevocationList(crl)
    } catch (error) {
      throw new X509Error('Failed to parse CRL', { cause: error instanceof Error ? error : undefined })
    }
  }

  /**
   * Parse a CRL from PEM or base64 encoded string
   */
  public static fromEncoded(encodedCrl: string): X509CertificateRevocationList {
    try {
      const crl = new x509.X509Crl(encodedCrl)
      return new X509CertificateRevocationList(crl)
    } catch (error) {
      throw new X509Error('Failed to parse encoded CRL', { cause: error instanceof Error ? error : undefined })
    }
  }

  /**
   * Get the raw CRL data
   */
  public get rawCertificateRevocationList(): Uint8Array {
    return new Uint8Array(this.crl.rawData)
  }

  /**
   * Get the issuer of the CRL
   */
  public get issuer(): string {
    return this.crl.issuer
  }

  /**
   * Get the date this CRL was issued
   */
  public get thisUpdate(): Date {
    return this.crl.thisUpdate
  }

  /**
   * Get the date when the next CRL will be published
   */
  public get nextUpdate(): Date | undefined {
    return this.crl.nextUpdate
  }

  /**
   * Check if the CRL has expired (past nextUpdate date)
   */
  public isExpired(date = new Date()): boolean {
    return this.nextUpdate ? date > this.nextUpdate : false
  }

  /**
   * Check if the CRL is not yet valid (before its thisUpdate date).
   */
  public isNotYetValid(date = new Date()): boolean {
    return date < this.thisUpdate
  }

  /**
   * Verify this CRL with the issuer's certificate.
   */
  public async verify(
    {
      issuerCertificate,
      verificationDate: now = new Date(),
    }: {
      issuerCertificate: X509Certificate
      verificationDate?: Date
    },
    webCrypto: CredoWebCrypto
  ): Promise<{ isValid: boolean; error?: Error }> {
    // 1. Verify the CRL signature with the issuer's public key.
    try {
      const publicJwk = issuerCertificate.publicJwk
      const cryptoKeyAlgorithm = publicJwkToCryptoKeyAlgorithm(publicJwk, {
        alg: publicJwk.kty === 'RSA' ? x509SignatureAlgorithmToJwa(this.crl.signatureAlgorithm) : undefined,
      })
      const publicCryptoKey = new CredoWebCryptoKey(publicJwk, cryptoKeyAlgorithm, true, 'public', ['verify'])

      const isValid = await this.crl.verify({ publicKey: publicCryptoKey }, webCrypto)

      if (!isValid) {
        return { isValid: false, error: new X509Error('CRL signature verification failed') }
      }
    } catch (error) {
      return {
        isValid: false,
        error: new X509Error('CRL signature verification failed', {
          cause: error instanceof Error ? error : undefined,
        }),
      }
    }

    // 2. The signature only proves the key matches; this binds the issuer name too. Compare the
    // DER-encoded distinguished names (not their string forms) for an exact, encoding-stable match.
    const crlIssuerNameBytes = new Uint8Array(this.crl.issuerName.toArrayBuffer())
    if (!uint8ArraysEqual(crlIssuerNameBytes, issuerCertificate.subjectNameBytes)) {
      return {
        isValid: false,
        error: new X509Error(
          `CRL issuer '${this.issuer}' does not match certificate issuer '${issuerCertificate.subject}'`
        ),
      }
    }

    // 3. Check the CRL validity window.
    if (this.isNotYetValid(now)) {
      return {
        isValid: false,
        error: new X509Error(`CRL is not yet valid (thisUpdate: ${this.thisUpdate.toISOString()})`),
      }
    }

    if (this.isExpired(now)) {
      return {
        isValid: false,
        error: new X509Error(`CRL has expired (nextUpdate: ${this.nextUpdate?.toISOString() ?? 'unknown'})`),
      }
    }

    return { isValid: true }
  }

  /**
   * Check if a certificate is revoked in this CRL.
   *
   * We compare serial numbers ourselves (normalizing case and leading zeros) instead of
   * delegating to `@peculiar/x509`'s `X509Crl.findRevoked`. The latter eagerly resolves the
   * global crypto provider (even though it isn't needed for a serial number comparison), which
   * throws when no provider has been registered globally.
   */
  public findRevoked(certificate: X509Certificate): RevokedCertificate | null {
    const target = normalizeSerialNumber(certificate.data.serialNumber)

    for (const entry of this.crl.entries) {
      if (normalizeSerialNumber(entry.serialNumber) === target) {
        return {
          serialNumber: entry.serialNumber,
          revocationDate: entry.revocationDate,
          reason: entry.reason,
        }
      }
    }

    return null
  }

  /**
   * Get all revoked certificates in this CRL
   */
  public get revokedCertificates(): RevokedCertificate[] {
    const revoked: RevokedCertificate[] = []

    for (const entry of this.crl.entries) {
      revoked.push({
        serialNumber: entry.serialNumber,
        revocationDate: entry.revocationDate,
        reason: entry.reason,
      })
    }

    return revoked
  }

  /**
   * Get the number of revoked certificates in this CRL
   */
  public get revokedCount(): number {
    return this.crl.entries.length
  }

  /**
   * @param format the format to export to, defaults to `pem`
   */
  public toString(format?: 'asn' | 'pem' | 'hex' | 'base64' | 'text' | 'base64url') {
    return this.crl.toString(format ?? 'pem')
  }

  public equal(crl: X509CertificateRevocationList) {
    const parsedOther = new x509.X509Crl(crl.rawCertificateRevocationList)

    return this.crl.equal(parsedOther)
  }
}
