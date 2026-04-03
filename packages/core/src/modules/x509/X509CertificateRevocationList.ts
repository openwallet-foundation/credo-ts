import * as x509 from '@peculiar/x509'
import type { AgentContext } from '../../agent'

import { CredoWebCrypto } from '../../crypto/webcrypto'
import { X509Certificate } from './X509Certificate'
import { X509Error } from './X509Error'

export interface RevokedCertificate {
  serialNumber: string
  revocationDate: Date
  reason?: number
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
   * Verify the CRL signature using the issuer's certificate
   */
  public async verify(
    agentContext: AgentContext,
    issuerCertificate: X509Certificate
  ): Promise<{ isValid: boolean; error?: Error }> {
    try {
      const webCrypto = new CredoWebCrypto(agentContext)
      const rawX509Certificate = new x509.X509Certificate(issuerCertificate.rawCertificate)
      const isValid = await this.crl.verify({ publicKey: rawX509Certificate }, webCrypto)

      if (!isValid) {
        return {
          isValid: false,
          error: new X509Error('CRL signature verification failed'),
        }
      }

      return { isValid: true }
    } catch (error) {
      return {
        isValid: false,
        error: new X509Error('CRL signature verification failed', {
          cause: error instanceof Error ? error : undefined,
        }),
      }
    }
  }

  /**
   * Check if a certificate is revoked in this CRL
   */
  public findRevoked(certificate: X509Certificate): RevokedCertificate | null {
    const rawCertificate = new x509.X509Certificate(certificate.rawCertificate)
    const revokedEntry = this.crl.findRevoked(rawCertificate)

    if (!revokedEntry) {
      return null
    }

    return {
      serialNumber: revokedEntry.serialNumber,
      revocationDate: revokedEntry.revocationDate,
      reason: revokedEntry.reason,
    }
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
