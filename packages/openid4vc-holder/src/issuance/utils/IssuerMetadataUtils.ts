import type { AuthDetails } from '../OpenId4VciHolderService'
import type {
  CredentialIssuerMetadata,
  CredentialOfferFormat,
  CredentialOfferPayloadV1_0_11,
  CredentialSupported,
  CredentialSupportedTypeV1_0_08,
  CredentialSupportedV1_0_08,
  EndpointMetadataResult,
  IssuerMetadataV1_0_08,
  OID4VCICredentialFormat,
} from '@sphereon/oid4vci-common'

import { AriesFrameworkError } from '@aries-framework/core'
import { MetadataClient } from '@sphereon/oid4vci-client'
import { OpenId4VCIVersion } from '@sphereon/oid4vci-common'

import { getUniformFormat } from './Formats'

/**
 * The type of a credential offer entry. For each item in `credentials` array, the type MUST be one of the following:
 *  - CredentialSupported, when the value is a string and points to a credential from the `credentials_supported` array.
 *  - InlineCredentialOffer, when the value is a JSON object that represents an inline credential offer.
 */
export enum OfferedCredentialType {
  CredentialSupported = 'CredentialSupported',
  InlineCredentialOffer = 'InlineCredentialOffer',
}

export type OfferedCredentialWithMetadata =
  | {
      credentialSupported: CredentialSupported
      offerType: OfferedCredentialType.CredentialSupported
      format: OID4VCICredentialFormat
      types: string[]
    }
  | {
      inlineCredentialOffer: CredentialOfferFormat
      offerType: OfferedCredentialType.InlineCredentialOffer
      format: OID4VCICredentialFormat
      types: string[]
    }

/**
 * Returns all entries from the credential offer with the associated metadata resolved. For inline entries, the offered credential object
 * is included directly. For 'id' entries, the associated `credentials_supported` object is resolved from the issuer metadata.
 *
 * NOTE: for v1_0-08, a single credential id in the issuer metadata could have multiple formats. This means that the returned value
 * from this method could contain multiple entries for a single credential id, but with different formats. This is detectable as the
 * id will be the `<credentialId>-<format>`.
 */
export function getOfferedCredentialsWithMetadata(
  credentialOfferPayload: CredentialOfferPayloadV1_0_11,
  issuerMetadata: CredentialIssuerMetadata | IssuerMetadataV1_0_08,
  version: OpenId4VCIVersion
) {
  const offeredCredentials: OfferedCredentialWithMetadata[] = []

  const supportedCredentials = getSupportedCredentials({ issuerMetadata, version })

  for (const offeredCredential of credentialOfferPayload.credentials) {
    // If the offeredCredential is a string, it has to reference a supported credential in the issuer metadata
    if (typeof offeredCredential === 'string') {
      const foundSupportedCredentials = supportedCredentials.filter(
        (supportedCredential) =>
          supportedCredential.id === offeredCredential ||
          supportedCredential.id === `${offeredCredential}-${supportedCredential.format}`
      )

      // Make sure the issuer metadata includes the offered credential.
      if (foundSupportedCredentials.length === 0) {
        throw new Error(
          `Offered credential '${offeredCredential}' is not part of credentials_supported of the issuer metadata.`
        )
      }

      for (const foundSupportedCredential of foundSupportedCredentials) {
        offeredCredentials.push({
          credentialSupported: foundSupportedCredential,
          offerType: OfferedCredentialType.CredentialSupported,
          format: getUniformFormat(foundSupportedCredential.format),
          types: foundSupportedCredential.types,
        })
      }
    }
    // Otherwise it's an inline credential offer that does not reference a supported credential in the issuer metadata
    else {
      offeredCredentials.push({
        inlineCredentialOffer: offeredCredential,
        offerType: OfferedCredentialType.InlineCredentialOffer,
        format: getUniformFormat(offeredCredential.format),
        types: offeredCredential.types,
      })
    }
  }

  return offeredCredentials
}

export async function getMetadataFromCredentialOffer(
  credentialOfferPayload: CredentialOfferPayloadV1_0_11,
  metadata?: EndpointMetadataResult
) {
  const issuer = credentialOfferPayload.credential_issuer

  const resolvedMetadata =
    metadata && metadata.credentialIssuerMetadata ? metadata : await MetadataClient.retrieveAllMetadata(issuer)

  if (!resolvedMetadata) {
    throw new AriesFrameworkError(`Could not retrieve metadata for OpenId4Vci issuer: ${issuer}`)
  }

  const issuerMetadata = resolvedMetadata.credentialIssuerMetadata
  if (!issuerMetadata) {
    throw new AriesFrameworkError(`Could not retrieve issuer metadata for OpenId4Vci issuer: ${issuer}`)
  }

  return { issuer, metadata: resolvedMetadata, issuerMetadata }
}

export function getSupportedCredentials(opts: {
  issuerMetadata: CredentialIssuerMetadata | IssuerMetadataV1_0_08
  version: OpenId4VCIVersion
}): CredentialSupported[] {
  const { issuerMetadata } = opts
  let credentialsSupported: CredentialSupported[]
  const { version } = opts ?? { version: OpenId4VCIVersion.VER_1_0_11 }

  const usesTransformedCredentialsSupported =
    version === OpenId4VCIVersion.VER_1_0_08 || !Array.isArray(issuerMetadata.credentials_supported)
  if (usesTransformedCredentialsSupported) {
    credentialsSupported = credentialsSupportedV8ToV11((issuerMetadata as IssuerMetadataV1_0_08).credentials_supported)
  } else {
    credentialsSupported = (issuerMetadata as CredentialIssuerMetadata).credentials_supported
  }

  if (credentialsSupported === undefined || credentialsSupported.length === 0) {
    return []
  } else {
    return credentialsSupported
  }
}

export function credentialsSupportedV8ToV11(supportedV8: CredentialSupportedTypeV1_0_08): CredentialSupported[] {
  return Object.entries(supportedV8).flatMap((entry) => {
    const type = entry[0]
    const supportedV8 = entry[1]
    return credentialSupportedV8ToV11(type, supportedV8)
  })
}

export function credentialSupportedV8ToV11(
  key: string,
  supportedV8: CredentialSupportedV1_0_08
): CredentialSupported[] {
  const v8FormatEntries = Object.entries(supportedV8.formats)

  return v8FormatEntries.map((entry) => {
    const format = entry[0]
    const credentialSupportBrief = entry[1]
    if (typeof format !== 'string') {
      throw Error(`Unknown format received ${JSON.stringify(format)}`)
    }

    // v8 format included the credential type / id as the key of the object and it could contain multiple supported formats
    // v11 format has an array where each entry only supports one format, and can only have an `id` property. We include the
    // key from the v8 object as the id for the v11 object, but to prevent collisions (as multiple formats can be supported under
    // one key), we append the format to the key IF there's more than one format supported under the key.
    const id = v8FormatEntries.length > 1 ? `${key}-${format}` : key

    let credentialSupported: CredentialSupported
    if (format === 'jwt_vc_json') {
      credentialSupported = {
        format,
        display: supportedV8.display,
        ...credentialSupportBrief,
        credentialSubject: supportedV8.claims,
        id,
      }
    } else {
      credentialSupported = {
        format,
        display: supportedV8.display,
        ...credentialSupportBrief,
        id,
        '@context': ['VerifiableCredential'], // NOTE: V8 credentials don't come with @context
      }
    }

    return credentialSupported
  })
}

// copied from sphereon
export function handleAuthorizationDetails(
  authorizationDetails: AuthDetails | AuthDetails[],
  metadata: EndpointMetadataResult
): AuthDetails | AuthDetails[] | undefined {
  if (Array.isArray(authorizationDetails)) {
    return authorizationDetails.map((value) => handleLocations({ ...value }, metadata))
  } else {
    return handleLocations({ ...authorizationDetails }, metadata)
  }
}

// copied from sphereon
export function handleLocations(authorizationDetails: AuthDetails, metadata: EndpointMetadataResult) {
  if (metadata.credentialIssuerMetadata?.authorization_server || metadata.authorization_endpoint) {
    if (!authorizationDetails.locations) authorizationDetails.locations = metadata.issuer
    else if (Array.isArray(authorizationDetails.locations)) authorizationDetails.locations.push(metadata.issuer)
    else authorizationDetails.locations = [authorizationDetails.locations as string, metadata.issuer]
  }
  return authorizationDetails
}
