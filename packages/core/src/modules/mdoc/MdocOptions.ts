import type { Mdoc } from './Mdoc'
import type { Key } from '../../crypto/Key'
import type { DifPresentationExchangeDefinition } from '../dif-presentation-exchange'
import type { ValidityInfo, MdocNameSpaces } from '@protokoll/mdoc-client'

export type { MdocNameSpaces } from '@protokoll/mdoc-client'

export type MdocVerifyOptions = {
  trustedCertificates?: [string, ...string[]]
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

export type MdocDeviceResponseVerifyOptions = {
  trustedCertificates?: [string, ...string[]]
  sessionTranscriptOptions: MdocOpenId4VpSessionTranscriptOptions
  /**
   * The base64Url-encoded device response string.
   */
  deviceResponse: string

  /**
   * The public ephemeral key used in the session where the DeviceResponse was obtained. This is only required if the DeviceResponse is using the MAC method for device authentication.
   */
  verifierKey?: Key
  now?: Date
}

export type MdocSignOptions = {
  // eslint-disable-next-line @typescript-eslint/ban-types
  docType: 'org.iso.18013.5.1.mDL' | (string & {})
  validityInfo?: Partial<ValidityInfo>
  namespaces: { [namespace: string]: Record<string, unknown> }

  /**
   *
   * The trusted base64-encoded issuer certificate string in the DER-format.
   */
  issuerCertificate: string
  holderKey: Key
}
