import type { Mdoc } from './Mdoc'
import type { Key } from '../../crypto/Key'
import type { DifPresentationExchangeDefinition } from '../dif-presentation-exchange'
import type { EncodedX509Certificate } from '../x509'
import type { DeviceRequest, ValidityInfo } from '@animo-id/mdoc'

export type MdocNameSpaces = Record<string, Record<string, unknown>>

export type MdocVerifyOptions = {
  trustedCertificates?: EncodedX509Certificate[]
  now?: Date
}

export type MdocOpenId4VpSessionTranscriptOptions = {
  responseUri: string
  clientId: string
  verifierGeneratedNonce: string
  mdocGeneratedNonce: string
}

export type MdocDeviceResponseOpenId4VpOptions = {
  mdocs: [Mdoc, ...Mdoc[]]
  presentationDefinition: DifPresentationExchangeDefinition
  deviceNameSpaces?: MdocNameSpaces
  sessionTranscriptOptions: MdocOpenId4VpSessionTranscriptOptions
}

export type MdocDeviceResponseOptions = {
  mdocs: [Mdoc, ...Mdoc[]]
  deviceRequest: DeviceRequest
  deviceNameSpaces?: MdocNameSpaces
  sessionTranscriptBytes: Uint8Array
}

export type MdocDeviceResponseVerifyOptions = {
  trustedCertificates?: EncodedX509Certificate[]
  sessionTranscriptOptions: MdocOpenId4VpSessionTranscriptOptions
  /**
   * The base64Url-encoded device response string.
   */
  deviceResponse: string
  now?: Date
}

export type MdocSignOptions = {
  // eslint-disable-next-line @typescript-eslint/ban-types
  docType: 'org.iso.18013.5.1.mDL' | (string & {})
  validityInfo?: Partial<ValidityInfo>
  namespaces: MdocNameSpaces

  /**
   *
   * The trusted base64-encoded issuer certificate string in the DER-format.
   */
  issuerCertificate: string
  holderKey: Key
}
