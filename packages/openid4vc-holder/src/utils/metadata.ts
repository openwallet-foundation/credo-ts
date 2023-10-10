import type { W3cCredentialRecord } from '@aries-framework/core'
import type {
  CredentialIssuerMetadata,
  CredentialsSupportedDisplay,
  CredentialSupported,
  EndpointMetadata,
  IssuerCredentialSubject,
  IssuerMetadataV1_0_08,
  MetadataDisplay,
} from '@sphereon/oid4vci-common'

export interface OpenId4VcCredentialMetadata {
  credential: {
    display?: CredentialsSupportedDisplay[]
    order?: string[]
    credentialSubject: IssuerCredentialSubject
  }
  issuer: {
    display?: MetadataDisplay[]
    id: string
  }
}

// what does this mean
const openId4VcCredentialMetadataKey = '_paradym/openId4VcCredentialMetadata'

function extractOpenId4VcCredentialMetadata(
  credentialMetadata: CredentialSupported,
  serverMetadata: EndpointMetadata,
  serverMetadataResult: CredentialIssuerMetadata | IssuerMetadataV1_0_08
) {
  return {
    credential: {
      display: credentialMetadata.display,
      order: credentialMetadata.order,
      credentialSubject: credentialMetadata.credentialSubject,
    },
    issuer: {
      display: serverMetadataResult.credentialIssuerMetadata?.display,
      id: serverMetadata.issuer,
    },
  }
}

/**
 * Gets the OpenId4Vc credential metadata from the given W3C credential record.
 */
export function getOpenId4VcCredentialMetadata(
  w3cCredentialRecord: W3cCredentialRecord
): OpenId4VcCredentialMetadata | null {
  return w3cCredentialRecord.metadata.get(openId4VcCredentialMetadataKey)
}

/**
 * Sets the OpenId4Vc credential metadata on the given W3C credential record.
 *
 * NOTE: this does not save the record.
 */
export function setOpenId4VcCredentialMetadata(
  w3cCredentialRecord: W3cCredentialRecord,
  credentialMetadata: CredentialSupported,
  serverMetadata: EndpointMetadata,
  serverMetadataResult: CredentialIssuerMetadata | IssuerMetadataV1_0_08
) {
  w3cCredentialRecord.metadata.set(
    openId4VcCredentialMetadataKey,
    extractOpenId4VcCredentialMetadata(credentialMetadata, serverMetadata, serverMetadataResult)
  )
}
