import type {
  CredentialIssuerMetadata,
  CredentialSupported,
  CredentialSupportedTypeV1_0_08,
  CredentialSupportedV1_0_08,
  IssuerMetadataV1_0_08,
  MetadataDisplay,
} from '@sphereon/oid4vci-common'

import { OpenId4VCIVersion } from '@sphereon/oid4vci-common'

export function getSupportedCredentials(opts?: {
  issuerMetadata?: CredentialIssuerMetadata | IssuerMetadataV1_0_08
  version: OpenId4VCIVersion
  credentialSupportedIds?: string[]
}): CredentialSupported[] {
  const { issuerMetadata } = opts ?? {}
  let credentialsSupported: CredentialSupported[]
  if (!issuerMetadata) {
    return []
  }
  const { version, credentialSupportedIds } = opts ?? { version: OpenId4VCIVersion.VER_1_0_11 }

  const usesTransformedCredentialsSupported =
    version === OpenId4VCIVersion.VER_1_0_08 || !Array.isArray(issuerMetadata.credentials_supported)
  if (usesTransformedCredentialsSupported) {
    credentialsSupported = credentialsSupportedV8ToV11((issuerMetadata as IssuerMetadataV1_0_08).credentials_supported)
  } else {
    credentialsSupported = (issuerMetadata as CredentialIssuerMetadata).credentials_supported
  }

  if (credentialsSupported === undefined || credentialsSupported.length === 0) {
    return []
  } else if (!credentialSupportedIds || credentialSupportedIds.length === 0) {
    return credentialsSupported
  }

  const credentialSupportedOverlap: CredentialSupported[] = []
  for (const credentialSupportedId of credentialSupportedIds) {
    if (typeof credentialSupportedId === 'string') {
      const supported = credentialsSupported.find((sup) => {
        // Match id to offerType
        if (sup.id === credentialSupportedId) return true

        // If the credential was transformed and the v8 variant supported multiple formats for the id, we
        // check if there is an id with the format
        // see credentialsSupportedV8ToV11
        if (usesTransformedCredentialsSupported && sup.id === `${credentialSupportedId}-${sup.format}`) return true

        return false
      })
      if (supported) {
        credentialSupportedOverlap.push(supported)
      }
    }
  }

  return credentialSupportedOverlap
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
    let credentialSupport: Partial<CredentialSupported> = {}

    // v8 format included the credential type / id as the key of the object and it could contain multiple supported formats
    // v11 format has an array where each entry only supports one format, and can only have an `id` property. We include the
    // key from the v8 object as the id for the v11 object, but to prevent collisions (as multiple formats can be supported under
    // one key), we append the format to the key IF there's more than one format supported under the key.
    const id = v8FormatEntries.length > 1 ? `${key}-${format}` : key

    credentialSupport = {
      format,
      display: supportedV8.display,
      ...credentialSupportBrief,
      credentialSubject: supportedV8.claims,
      id,
    }
    return credentialSupport as CredentialSupported
  })
}

export function getIssuerDisplays(
  metadata: CredentialIssuerMetadata | IssuerMetadataV1_0_08,
  opts?: { prefLocales: string[] }
): MetadataDisplay[] {
  const matchedDisplays =
    metadata.display?.filter(
      (item) =>
        !opts?.prefLocales ||
        opts.prefLocales.length === 0 ||
        (item.locale && opts.prefLocales.includes(item.locale)) ||
        !item.locale
    ) ?? []
  return matchedDisplays.sort((item) => (item.locale ? opts?.prefLocales.indexOf(item.locale) ?? 1 : Number.MAX_VALUE))
}
