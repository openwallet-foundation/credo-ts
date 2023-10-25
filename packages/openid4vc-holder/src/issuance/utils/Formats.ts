import type { OID4VCICredentialFormat } from '@sphereon/oid4vci-common'
import type { CredentialFormat } from '@sphereon/ssi-types'

import { OpenId4VCIVersion } from '@sphereon/oid4vci-common'

// Base on https://github.com/Sphereon-Opensource/OID4VCI/pull/54/files

const isUniformFormat = (format: string): format is OID4VCICredentialFormat => {
  return ['jwt_vc_json', 'jwt_vc_json-ld', 'ldp_vc'].includes(format)
}

export function getUniformFormat(format: string | OID4VCICredentialFormat | CredentialFormat): OID4VCICredentialFormat {
  // Already valid format
  if (isUniformFormat(format)) {
    return format
  }

  // Older formats
  if (format === 'jwt_vc' || format === 'jwt') {
    return 'jwt_vc_json'
  }
  if (format === 'ldp_vc' || format === 'ldp') {
    return 'ldp_vc'
  }

  throw new Error(`Invalid format: ${format}`)
}

export function getFormatForVersion(format: string, version: OpenId4VCIVersion) {
  const uniformFormat = isUniformFormat(format) ? format : getUniformFormat(format)

  if (version < OpenId4VCIVersion.VER_1_0_11) {
    if (uniformFormat === 'jwt_vc_json') {
      return 'jwt_vc' as const
    } else if (uniformFormat === 'ldp_vc' || uniformFormat === 'jwt_vc_json-ld') {
      return 'ldp_vc' as const
    }
  }

  return uniformFormat
}
