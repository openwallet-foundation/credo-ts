import type {
  AuthorizationDetails,
  CredentialIssuerMetadata,
  CredentialOfferFormat,
  CredentialOfferFormatJwtVcJson,
  CredentialOfferFormatJwtVcJsonLdAndLdpVc,
  CredentialOfferFormatSdJwtVc,
  CredentialOfferPayloadV1_0_11,
  CredentialSupported,
  CredentialSupportedJwtVcJson,
  CredentialSupportedJwtVcJsonLdAndLdpVc,
  CredentialSupportedSdJwtVc,
  CredentialSupportedTypeV1_0_08,
  CredentialSupportedV1_0_08,
  EndpointMetadataResult,
  IssuerMetadataV1_0_08,
} from '@sphereon/oid4vci-common'

import { AriesFrameworkError } from '@aries-framework/core'
import { MetadataClient } from '@sphereon/oid4vci-client'
import { OpenId4VCIVersion } from '@sphereon/oid4vci-common'

import { getUniformFormat, getFormatForVersion } from './Formats'
import { OpenId4VciCredentialFormatProfile } from './claimFormatMapping'

/**
 * The type of a credential offer entry. For each item in `credentials` array, the type MUST be one of the following:
 *  - CredentialSupported, when the value is a string and points to a credential from the `credentials_supported` array.
 *  - InlineCredentialOffer, when the value is a JSON object that represents an inline credential offer.
 */
export enum OfferedCredentialType {
  CredentialSupported = 'CredentialSupported',
  InlineCredentialOffer = 'InlineCredentialOffer',
}

export type InlineOfferedCredentialWithMetadata =
  | {
      offerType: OfferedCredentialType.InlineCredentialOffer
      format: OpenId4VciCredentialFormatProfile.JwtVcJson
      credentialOffer: CredentialOfferFormatJwtVcJson
      types: string[]
    }
  | {
      offerType: OfferedCredentialType.InlineCredentialOffer
      format: OpenId4VciCredentialFormatProfile.JwtVcJsonLd | OpenId4VciCredentialFormatProfile.LdpVc
      credentialOffer: CredentialOfferFormatJwtVcJsonLdAndLdpVc
      types: string[]
    }
  | {
      offerType: OfferedCredentialType.InlineCredentialOffer
      format: OpenId4VciCredentialFormatProfile.SdJwtVc
      credentialOffer: CredentialOfferFormatSdJwtVc
      types: string[]
    }

export type ReferencedOfferedCredentialWithMetadata =
  | {
      offerType: OfferedCredentialType.CredentialSupported
      format: OpenId4VciCredentialFormatProfile.JwtVcJson
      credentialSupported: CredentialSupportedJwtVcJson
      types: string[]
    }
  | {
      offerType: OfferedCredentialType.CredentialSupported
      format: OpenId4VciCredentialFormatProfile.JwtVcJsonLd | OpenId4VciCredentialFormatProfile.LdpVc
      credentialSupported: CredentialSupportedJwtVcJsonLdAndLdpVc
      types: string[]
    }
  | {
      offerType: OfferedCredentialType.CredentialSupported
      format: OpenId4VciCredentialFormatProfile.SdJwtVc
      credentialSupported: CredentialSupportedSdJwtVc
      types: string[]
    }

export type OfferedCredentialWithMetadata =
  | ReferencedOfferedCredentialWithMetadata
  | InlineOfferedCredentialWithMetadata

/**
 * Returns all entries from the credential offer with the associated metadata resolved. For inline entries, the offered credential object
 * is included directly. For 'id' entries, the associated `credentials_supported` object is resolved from the issuer metadata.
 *
 * NOTE: for v1_0-08, a single credential id in the issuer metadata could have multiple formats. This means that the returned value
 * from this method could contain multiple entries for a single credential id, but with different formats. This is detectable as the
 * id will be the `<credentialId>-<format>`.
 */
export function getOfferedCredentialsWithMetadata(
  credentialOffers: (CredentialOfferFormat | string)[],
  supportedCredentials: CredentialSupported[]
) {
  const offeredCredentialsWithMetadata: OfferedCredentialWithMetadata[] = []

  for (const offeredCredential of credentialOffers) {
    // If the offeredCredential is a string, it has to reference a supported credential in the issuer metadata
    if (typeof offeredCredential === 'string') {
      const foundSupportedCredentials = supportedCredentials.filter(
        (supportedCredential) =>
          supportedCredential.id === offeredCredential ||
          supportedCredential.id ===
            `${offeredCredential}-${getFormatForVersion(supportedCredential.format, OpenId4VCIVersion.VER_1_0_08)}`
      )

      // Make sure the issuer metadata includes the offered credential.
      if (foundSupportedCredentials.length === 0) {
        throw new Error(
          `Offered credential '${offeredCredential}' is not part of credentials_supported of the issuer metadata.`
        )
      }

      for (const foundSupportedCredential of foundSupportedCredentials) {
        if (foundSupportedCredential.format === 'vc+sd-jwt') {
          offeredCredentialsWithMetadata.push({
            offerType: OfferedCredentialType.CredentialSupported,
            credentialSupported: foundSupportedCredential,
            format: OpenId4VciCredentialFormatProfile.SdJwtVc,
            types: [foundSupportedCredential.vct],
          })
        } else {
          offeredCredentialsWithMetadata.push({
            offerType: OfferedCredentialType.CredentialSupported,
            credentialSupported: foundSupportedCredential,
            format: getUniformFormat(foundSupportedCredential.format),
            types: foundSupportedCredential.types,
          } as OfferedCredentialWithMetadata)
        }
      }
    }
    // Otherwise it's an inline credential offer that does not reference a supported credential in the issuer metadata
    else {
      let types: string[]
      if (offeredCredential.format === 'jwt_vc_json') {
        types = offeredCredential.types
      } else if (offeredCredential.format === 'jwt_vc_json-ld' || offeredCredential.format === 'ldp_vc') {
        types = offeredCredential.credential_definition.types
      } else if (offeredCredential.format === 'vc+sd-jwt') {
        types = [offeredCredential.vct]
      } else {
        throw new AriesFrameworkError(`Unknown format received ${JSON.stringify(offeredCredential.format)}`)
      }

      offeredCredentialsWithMetadata.push({
        offerType: OfferedCredentialType.InlineCredentialOffer,
        format: getUniformFormat(offeredCredential.format),
        types: types,
        credentialOffer: offeredCredential,
      } as OfferedCredentialWithMetadata)
    }
  }

  return offeredCredentialsWithMetadata
}

export async function getMetadataFromCredentialOffer(
  credentialOfferPayload: CredentialOfferPayloadV1_0_11,
  metadata?: EndpointMetadataResult
) {
  const issuer = credentialOfferPayload.credential_issuer

  const resolvedMetadata = metadata?.credentialIssuerMetadata
    ? metadata
    : await MetadataClient.retrieveAllMetadata(issuer)

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
    const credentialId = entry[0]
    const supportedV8 = entry[1]
    return credentialSupportedV8ToV11(credentialId, supportedV8)
  })
}

export function credentialSupportedV8ToV11(
  credentialId: string,
  supportedV8: CredentialSupportedV1_0_08
): CredentialSupported[] {
  const v8FormatEntries = Object.entries(supportedV8.formats)

  return v8FormatEntries.map((entry) => {
    const format = entry[0]
    const credentialSupportedV8 = entry[1]
    if (typeof format !== 'string') {
      throw Error(`Unknown format received ${JSON.stringify(format)}`)
    }

    // v8 format included the credential type / id as the key of the object and it could contain multiple supported formats
    // v11 format has an array where each entry only supports one format, and can only have an `id` property. We include the
    // key from the v8 object as the id for the v11 object, but to prevent collisions (as multiple formats can be supported under
    // one key), we append the format to the key IF there's more than one format supported under the key.
    const id = v8FormatEntries.length > 1 ? `${credentialId}-${format}` : credentialId

    let credentialSupported: CredentialSupported
    const v11Format = getUniformFormat(format)
    if (v11Format === OpenId4VciCredentialFormatProfile.JwtVcJson) {
      credentialSupported = {
        format: OpenId4VciCredentialFormatProfile.JwtVcJson,
        display: supportedV8.display,
        ...credentialSupportedV8,
        credentialSubject: supportedV8.claims,
        id,
      }
    } else if (
      v11Format === OpenId4VciCredentialFormatProfile.JwtVcJsonLd ||
      v11Format === OpenId4VciCredentialFormatProfile.LdpVc
    ) {
      credentialSupported = {
        format: v11Format,
        display: supportedV8.display,
        ...credentialSupportedV8,
        id,
        '@context': ['VerifiableCredential'], // NOTE: V8 credentials don't come with @context
      }
    } else {
      throw new AriesFrameworkError(`Invalid format received for OpenId4Vci V8 '${format}'`)
    }

    return credentialSupported
  })
}

// copied from sphereon
export function handleAuthorizationDetails(
  authorizationDetails: AuthorizationDetails | AuthorizationDetails[],
  metadata: EndpointMetadataResult
): AuthorizationDetails | AuthorizationDetails[] | undefined {
  if (Array.isArray(authorizationDetails)) {
    return authorizationDetails.map((value) => handleLocations(value, metadata))
  } else {
    return handleLocations(authorizationDetails, metadata)
  }
}

// copied from sphereon
export function handleLocations(authorizationDetails: AuthorizationDetails, metadata: EndpointMetadataResult) {
  if (typeof authorizationDetails === 'string') return authorizationDetails
  if (metadata.credentialIssuerMetadata?.authorization_server || metadata.authorization_endpoint) {
    if (!authorizationDetails.locations) authorizationDetails.locations = [metadata.issuer]
    else if (Array.isArray(authorizationDetails.locations)) authorizationDetails.locations.push(metadata.issuer)
    else authorizationDetails.locations = [authorizationDetails.locations as string, metadata.issuer]
  }
  return authorizationDetails
}
