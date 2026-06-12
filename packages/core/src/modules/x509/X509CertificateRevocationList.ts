import { AsnParser } from '@peculiar/asn1-schema'
import { IssuingDistributionPoint as AsnIssuingDistributionPoint, BaseCRLNumber, CRLNumber } from '@peculiar/asn1-x509'
import * as x509 from '@peculiar/x509'
import {
  CredoWebCrypto,
  CredoWebCryptoKey,
  jwaAlgorithmToKeySignParams,
  publicJwkToCryptoKeyAlgorithm,
} from '../../crypto/webcrypto'
import {
  convertName,
  createAuthorityKeyIdentifierExtension,
  createCrlEntryCertificateIssuerExtension,
  createCrlNumberExtension,
  createIssuingDistributionPointExtension,
  X509CrlExtensionIdentifier,
  x509SignatureAlgorithmToJwa,
} from './utils'
import { X509Certificate } from './X509Certificate'
import type { X509RevocationReason } from './X509CrlDistributionPoint'
import { X509Error } from './X509Error'
import type { X509CreateCertificateRevocationListOptions } from './X509ServiceOptions'

/**
 * Reason a certificate was revoked, as carried in a CRL entry's `reasonCode` extension
 * (RFC 5280 §5.3.1 `CRLReason`).
 */
export enum X509CertificateRevocationListEntryReason {
  Unused = 0,
  KeyCompromise = 1,
  CACompromise = 2,
  AffiliationChanged = 3,
  Superseded = 4,
  CessationOfOperation = 5,
  CertificateHold = 6,
  RemoveFromCrl = 8,
  PrivilegeWithdrawn = 9,
  AACompromise = 10,
}

export interface X509CertificateRevocationListEntry {
  serialNumber: string
  revocationDate: Date
  reason?: X509CertificateRevocationListEntryReason
}

/**
 * Parsed Issuing Distribution Point CRL extension (RFC 5280 §5.2.5), describing the scope of a CRL.
 */
export interface X509IssuingDistributionPoint {
  /** Distribution point name as a list of URIs (other GeneralName forms are ignored). */
  fullName: string[]
  /** Whether the CRL only covers end-entity certificates. */
  onlyContainsUserCerts: boolean
  /** Whether the CRL only covers CA certificates. */
  onlyContainsCACerts: boolean
  /** The revocation reasons this CRL is limited to (reasonFlags bits), if scoped. */
  onlySomeReasons?: X509RevocationReason[]
  /** Whether this is an indirect CRL (entries may carry a `certificateIssuer`). */
  indirectCRL: boolean
  /** Whether the CRL only covers attribute certificates. */
  onlyContainsAttributeCerts: boolean
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
   * Create and sign a new CRL.
   *
   * Supports the CRL Number, Authority Key Identifier and Issuing Distribution Point extensions, as
   * well as indirect CRLs (per-entry `certificateIssuer`). See `options.extensions` / entry options.
   *
   * NOTE: scoped (Issuing Distribution Point) and indirect CRLs can be created here, but are not yet
   * validated during revocation checking.
   */
  public static async create(
    options: X509CreateCertificateRevocationListOptions,
    webCrypto: CredoWebCrypto
  ): Promise<X509CertificateRevocationList> {
    const signingKey = new CredoWebCryptoKey(
      options.authorityKey,
      publicJwkToCryptoKeyAlgorithm(options.authorityKey),
      false,
      'private',
      ['sign']
    )

    const entries = options.entries?.map((entry) => {
      const serialNumber = entry.serialNumber ?? entry.certificate?.data.serialNumber
      if (!serialNumber) {
        throw new X509Error('A CRL entry must provide either a serialNumber or a certificate')
      }

      return {
        serialNumber,
        revocationDate: entry.revocationDate,
        // X509CrlEntryReason mirrors @peculiar/x509's X509CrlReason (RFC 5280 CRLReason) values.
        reason: entry.reason === undefined ? undefined : (entry.reason as number as x509.X509CrlReason),
        // For indirect CRLs, the certificateIssuer is carried as a (critical) CRL entry extension.
        extensions: entry.issuer === undefined ? undefined : [createCrlEntryCertificateIssuerExtension(entry.issuer)],
      } satisfies x509.X509CrlEntryParams
    })

    const extensions: Array<x509.Extension | undefined> = [
      createCrlNumberExtension(options.extensions?.crlNumber),
      createAuthorityKeyIdentifierExtension(options.extensions?.authorityKeyIdentifier, {
        publicJwk: options.authorityKey,
      }),
      createIssuingDistributionPointExtension(options.extensions?.issuingDistributionPoint),
    ]

    const crl = await x509.X509CrlGenerator.create(
      {
        issuer: convertName(options.issuer),
        thisUpdate: options.validity?.thisUpdate,
        nextUpdate: options.validity?.nextUpdate,
        signingKey,
        signingAlgorithm: jwaAlgorithmToKeySignParams(options.authorityKey.signatureAlgorithm),
        entries,
        extensions: extensions.filter((extension): extension is x509.Extension => extension !== undefined),
      },
      webCrypto
    )

    return new X509CertificateRevocationList(crl)
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

  private getMatchingExtensions<T = { critical: boolean }>(objectIdentifier: string): Array<T> {
    return this.crl.extensions.filter((e) => e.type === objectIdentifier) as Array<T>
  }

  /**
   * CRL Number (RFC 5280 §5.2.3): the monotonically increasing sequence number of this CRL.
   */
  public get crlNumber(): number | undefined {
    const extensions = this.getMatchingExtensions<x509.Extension>(X509CrlExtensionIdentifier.CrlNumber)

    if (extensions.length > 1) {
      throw new X509Error('Multiple CRL Number extensions are not allowed')
    }

    const extension = extensions[0]
    if (!extension) return undefined

    return AsnParser.parse(extension.value, CRLNumber).value
  }

  /**
   * Delta CRL Indicator (RFC 5280 §5.2.4): when present, this CRL is a delta CRL and the value is
   * the CRL Number of the base (complete) CRL it is relative to. `undefined` for a complete CRL.
   */
  public get deltaCrlIndicator(): number | undefined {
    const extensions = this.getMatchingExtensions<x509.Extension>(X509CrlExtensionIdentifier.DeltaCrlIndicator)

    if (extensions.length > 1) {
      throw new X509Error('Multiple Delta CRL Indicator extensions are not allowed')
    }

    const extension = extensions[0]
    if (!extension) return undefined

    return AsnParser.parse(extension.value, BaseCRLNumber).value
  }

  /**
   * Issuing Distribution Point (RFC 5280 §5.2.5), describing the scope of this CRL.
   *
   * NOTE: only the URI form of the distribution point name is surfaced; other GeneralName forms and
   * `nameRelativeToCRLIssuer` are ignored.
   */
  public get issuingDistributionPoint(): X509IssuingDistributionPoint | undefined {
    const extensions = this.getMatchingExtensions<x509.Extension>(X509CrlExtensionIdentifier.IssuingDistributionPoint)

    if (extensions.length > 1) {
      throw new X509Error('Multiple Issuing Distribution Point extensions are not allowed')
    }

    const extension = extensions[0]
    if (!extension) return undefined

    const idp = AsnParser.parse(extension.value, AsnIssuingDistributionPoint)

    const fullName: string[] = []
    if (idp.distributionPoint?.fullName) {
      for (const generalName of idp.distributionPoint.fullName) {
        if (generalName.uniformResourceIdentifier) {
          fullName.push(generalName.uniformResourceIdentifier)
        }
      }
    }

    let onlySomeReasons: X509RevocationReason[] | undefined
    if (idp.onlySomeReasons) {
      // The ASN.1 BIT STRING uses bit `i` for revocation reason code `i` (e.g. keyCompromise = bit 1).
      const reasonBits = idp.onlySomeReasons.toNumber()
      onlySomeReasons = []
      for (let i = 0; i <= 8; i++) {
        if ((reasonBits & (1 << i)) !== 0) {
          onlySomeReasons.push(i)
        }
      }
    }

    return {
      fullName,
      onlyContainsUserCerts: idp.onlyContainsUserCerts,
      onlyContainsCACerts: idp.onlyContainsCACerts,
      onlySomeReasons,
      indirectCRL: idp.indirectCRL,
      onlyContainsAttributeCerts: idp.onlyContainsAttributeCerts,
    }
  }

  /**
   * Whether the extension with the given id is marked critical. Throws if the extension is absent.
   */
  public isExtensionCritical(id: X509CrlExtensionIdentifier | string): boolean {
    const extensions = this.getMatchingExtensions(id)
    if (extensions.length === 0) {
      throw new X509Error(`extension with id '${id}' is not found`)
    }

    return !!extensions[0].critical
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
  public findRevoked(certificate: X509Certificate): X509CertificateRevocationListEntry | null {
    const target = normalizeSerialNumber(certificate.data.serialNumber)

    for (const entry of this.crl.entries) {
      if (normalizeSerialNumber(entry.serialNumber) === target) {
        return {
          serialNumber: entry.serialNumber,
          revocationDate: entry.revocationDate,
          reason: entry.reason as unknown as X509CertificateRevocationListEntryReason | undefined,
        }
      }
    }

    return null
  }

  /**
   * Get all revoked certificates in this CRL
   */
  public get revokedCertificates(): X509CertificateRevocationListEntry[] {
    const revoked: X509CertificateRevocationListEntry[] = []

    for (const entry of this.crl.entries) {
      revoked.push({
        serialNumber: entry.serialNumber,
        revocationDate: entry.revocationDate,
        reason: entry.reason as unknown as X509CertificateRevocationListEntryReason | undefined,
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
