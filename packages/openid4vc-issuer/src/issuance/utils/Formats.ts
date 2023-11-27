import type { CredentialFormat } from '@sphereon/ssi-types'

import { AriesFrameworkError } from '@aries-framework/core'
import { OpenId4VCIVersion } from '@sphereon/oid4vci-common'

import { OpenIdCredentialFormatProfile } from './claimFormatMapping'

// Based on https://github.com/Sphereon-Opensource/OID4VCI/pull/54/files

// check if a string is a valid enum value of OpenIdCredentialFormatProfile

const isUniformFormat = (format: string): format is OpenIdCredentialFormatProfile => {
  return Object.values(OpenIdCredentialFormatProfile).includes(format as OpenIdCredentialFormatProfile)
}

export function getUniformFormat(
  format: string | OpenIdCredentialFormatProfile | CredentialFormat
): OpenIdCredentialFormatProfile {
  // Already valid format
  if (isUniformFormat(format)) return format

  // Older formats
  if (format === 'jwt_vc' || format === 'jwt') {
    return OpenIdCredentialFormatProfile.JwtVcJson
  }
  if (format === 'ldp_vc' || format === 'ldp') {
    return OpenIdCredentialFormatProfile.LdpVc
  }

  throw new AriesFrameworkError(`Invalid format: ${format}`)
}

export function getFormatForVersion(format: string, version: OpenId4VCIVersion) {
  const uniformFormat = getUniformFormat(format)

  if (version < OpenId4VCIVersion.VER_1_0_11) {
    if (uniformFormat === 'jwt_vc_json') {
      return 'jwt_vc' as const
    } else if (uniformFormat === 'ldp_vc' || uniformFormat === 'jwt_vc_json-ld') {
      return 'ldp_vc' as const
    }
  }

  return uniformFormat
}
