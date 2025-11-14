import type { ValidityInfo } from '@animo-id/mdoc'
import type { AnyUint8Array } from '../../types'
import type { DifPresentationExchangeDefinition } from '../dif-presentation-exchange'
import { PublicJwk } from '../kms'
import type { EncodedX509Certificate, X509Certificate } from '../x509'
import { Mdoc } from './Mdoc'
import { MdocRecord } from './repository'

export { DateOnly } from '@animo-id/mdoc'

export type MdocNameSpaces = Record<string, Record<string, unknown>>

export interface MdocStoreOptions {
  record: MdocRecord
}

export type MdocVerifyOptions = {
  trustedCertificates?: EncodedX509Certificate[]
  now?: Date
}

export type MdocOpenId4VpSessionTranscriptOptions = {
  type: 'openId4Vp'
  responseUri: string
  clientId: string
  verifierGeneratedNonce: string
  encryptionJwk?: PublicJwk
}

export type MdocOpenId4VpDraft18SessionTranscriptOptions = {
  type: 'openId4VpDraft18'
  responseUri: string
  clientId: string
  verifierGeneratedNonce: string
  mdocGeneratedNonce: string
}

export type MdocSessionTranscriptByteOptions = {
  type: 'sesionTranscriptBytes'
  sessionTranscriptBytes: AnyUint8Array
}

export type MdocOpenId4VpDcApiSessionTranscriptOptions = {
  type: 'openId4VpDcApi'
  origin: string
  verifierGeneratedNonce: string
  encryptionJwk?: PublicJwk
}

export type MdocOpenId4VpDcApiDraft24SessionTranscriptOptions = {
  type: 'openId4VpDcApiDraft24'
  clientId: string
  origin: string
  verifierGeneratedNonce: string
}

export type MdocSessionTranscriptOptions =
  | MdocOpenId4VpSessionTranscriptOptions
  | MdocOpenId4VpDraft18SessionTranscriptOptions
  | MdocSessionTranscriptByteOptions
  | MdocOpenId4VpDcApiSessionTranscriptOptions
  | MdocOpenId4VpDcApiDraft24SessionTranscriptOptions

export type MdocDocumentRequest = {
  docType: string
  nameSpaces: Record<string, Record<string, boolean>>
}

export type MdocDeviceResponseOptions = {
  mdocs: [Mdoc, ...Mdoc[]]
  documentRequests: MdocDocumentRequest[]
  deviceNameSpaces?: MdocNameSpaces
  sessionTranscriptOptions: MdocSessionTranscriptOptions
}

export type MdocDeviceResponsePresentationDefinitionOptions = {
  mdocs: [Mdoc, ...Mdoc[]]
  presentationDefinition: DifPresentationExchangeDefinition
  deviceNameSpaces?: MdocNameSpaces
  sessionTranscriptOptions: MdocSessionTranscriptOptions
}

export type MdocDeviceResponseVerifyOptions = {
  trustedCertificates?: EncodedX509Certificate[]
  sessionTranscriptOptions: MdocSessionTranscriptOptions
  /**
   * The base64Url-encoded device response string.
   */
  deviceResponse: string
  now?: Date
}

export type MdocSignOptions = {
  docType: 'org.iso.18013.5.1.mDL' | (string & {})
  validityInfo?: Partial<ValidityInfo>
  namespaces: MdocNameSpaces

  /**
   *
   * The X509 certificate to use for signing the mDOC. The certificate MUST have a
   * publicJwk with key id configured, enabling signing with the KMS
   */
  issuerCertificate: X509Certificate
  holderKey: PublicJwk
}
