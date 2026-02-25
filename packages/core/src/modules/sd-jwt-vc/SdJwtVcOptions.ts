import type { SdJwtVcPayload } from '@sd-jwt/sd-jwt-vc'
import type { HashName } from '../../crypto'
import { PublicJwk } from '../kms'
import type { EncodedX509Certificate, X509Certificate } from '../x509'
import { SdJwtVcRecord } from './repository'
import type { SdJwtVc } from './SdJwtVcService'

export interface SdJwtVcStoreOptions {
  record: SdJwtVcRecord
}

export type { SdJwtVcPayload }
export type SdJwtVcHeader = Record<string, unknown>

export interface IDisclosureFrame {
  _sd?: string[]
  _sd_decoy?: number
  [x: string]: string[] | number | IDisclosureFrame | undefined
}

export interface IPresentationFrame {
  [x: string]: boolean | IPresentationFrame
}

export interface SdJwtVcHolderDidBinding {
  method: 'did'
  didUrl: string
}

export interface SdJwtVcHolderJwkBinding {
  method: 'jwk'
  jwk: PublicJwk
}

export interface SdJwtVcIssuerDid {
  method: 'did'

  // didUrl referencing a specific key in a did document.
  didUrl: string
}

export interface SdJwtVcIssuerX5c {
  method: 'x5c'

  /**
   *
   * Array of X509 certificates.
   *
   * The certificate containing the public key corresponding to the key used to digitally sign the JWS MUST be the first certificate.
   */
  x5c: X509Certificate[]

  /**
   * The issuer of the SD-JWT VC.
   *
   * NOTE: in the latest draft of SD-JWT VC the issuer field is optional when using an X509 certificates
   * to sign the SD-JWT VC.
   *
   * Since it's not clear what the iss value should be Credo will likely require
   * the value to be undefined in a future version, but for now if the issuer value
   * is defined it MUST match an SAN URI or DNS entry in the leaf certificate, mimicking
   * previous behavior.
   */
  issuer?: string
}

// We support jwk and did based binding for the holder at the moment
export type SdJwtVcHolderBinding = SdJwtVcHolderDidBinding | SdJwtVcHolderJwkBinding

// We only support did and x509 based issuance currently, but we might want to add support
// for issuer metadata (as defined in SD-JWT VC) in the future
export type SdJwtVcIssuer = SdJwtVcIssuerDid | SdJwtVcIssuerX5c

export interface SdJwtVcSignOptions<Payload extends SdJwtVcPayload = SdJwtVcPayload> {
  payload: Payload

  /**
   * If holder is not provided, we don't bind the SD-JWT VC to a key (so bearer VC)
   */
  holder?: SdJwtVcHolderBinding
  issuer: SdJwtVcIssuer
  disclosureFrame?: IDisclosureFrame

  /**
   * Default of sha-256 will be used if not provided
   */
  hashingAlgorithm?: HashName

  /**
   * The header 'typ' to use for the SD-JWT VC. vc+sd-jwt is supported
   * for backwards compatibility but implementations should update to
   * dc+sd-jwt
   *
   * @default 'dc+sd-jwt'
   */
  headerType?: 'dc+sd-jwt' | 'vc+sd-jwt'
}

// TODO: use the payload type once types are fixed
export type SdJwtVcPresentOptions<_Payload extends SdJwtVcPayload = SdJwtVcPayload> = {
  sdJwtVc: string | SdJwtVc

  /**
   * Use true to disclose everything
   */
  presentationFrame?: IPresentationFrame

  /**
   * This information is received out-of-band from the verifier.
   * The claims will be used to create a normal JWT, used for key binding.
   *
   * If not defined, a KB-JWT will not be created
   */
  verifierMetadata?: {
    audience: string
    nonce: string
    issuedAt: number
  }

  /**
   * Additional payload to include in the KB JWT
   */
  additionalPayload?: Record<string, unknown>
}

export type SdJwtVcVerifyOptions = {
  compactSdJwtVc: string

  /**
   * If the key binding object is present, the sd-jwt is required to have a key binding jwt attached
   * and will be validated against the provided key binding options.
   */
  keyBinding?: {
    /**
     * The expected `aud` value in the payload of the KB-JWT. The value of this is dependant on the
     * exchange protocol used.
     */
    audience: string

    /**
     * The expected `nonce` value in the payload of the KB-JWT. The value of this is dependant on the
     * exchange protocol used.
     */
    nonce: string
  }

  // TODO: update to requiredClaimFrame
  requiredClaimKeys?: Array<string>

  /**
   * Whether to fetch the `vct` type metadata
   *
   * It will will not influence the verification result if fetching of type metadata fails
   *
   * @default false
   */
  fetchTypeMetadata?: boolean

  /**
   * Whether to verify the status of the credential. If set to false and the credential
   * has a status, it will not be fetched and verified.
   *
   * @default true
   */
  verifyCredentialStatus?: boolean

  trustedCertificates?: EncodedX509Certificate[]

  /**
   * Date that should be used as the current time. If not provided, current time will be used.
   */
  now?: Date
}
