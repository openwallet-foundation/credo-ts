import type { AgentContext } from '../../../agent'
import type { SdJwtVcRecord } from '../../sd-jwt-vc'
import type { W3cJsonPresentation } from '../../vc/models/presentation/W3cJsonPresentation'
import type { VerifiablePresentation } from '../models'
import type {
  OriginalVerifiableCredential as SphereonOriginalVerifiableCredential,
  OriginalVerifiablePresentation as SphereonOriginalVerifiablePresentation,
  W3CVerifiablePresentation as SphereonW3CVerifiablePresentation,
} from '@sphereon/ssi-types'

import { CredoError } from '../../../error'
import { JsonTransformer } from '../../../utils'
import { MdocVerifiablePresentation } from '../../mdoc/MdocVerifiablePresentation'
import { SdJwtVcApi } from '../../sd-jwt-vc'
import { W3cCredentialRecord, W3cJsonLdVerifiablePresentation, W3cJwtVerifiablePresentation } from '../../vc'

export function getSphereonOriginalVerifiableCredential(
  credentialRecord: W3cCredentialRecord | SdJwtVcRecord
): SphereonOriginalVerifiableCredential {
  if (credentialRecord instanceof W3cCredentialRecord) {
    return credentialRecord.credential.encoded as SphereonOriginalVerifiableCredential
  } else {
    return credentialRecord.compactSdJwtVc
  }
}

export function getSphereonOriginalVerifiablePresentation(
  verifiablePresentation: VerifiablePresentation
): SphereonOriginalVerifiablePresentation {
  if (
    verifiablePresentation instanceof W3cJwtVerifiablePresentation ||
    verifiablePresentation instanceof W3cJsonLdVerifiablePresentation
  ) {
    return verifiablePresentation.encoded as SphereonOriginalVerifiablePresentation
  } else if (verifiablePresentation instanceof MdocVerifiablePresentation) {
    throw new CredoError('Mdoc verifiable presentation is not yet supported by Sphereon.')
  } else {
    return verifiablePresentation.compact
  }
}

// TODO: we might want to move this to some generic vc transformation util
export function getVerifiablePresentationFromEncoded(
  agentContext: AgentContext,
  encodedVerifiablePresentation: string | W3cJsonPresentation | SphereonW3CVerifiablePresentation
) {
  if (typeof encodedVerifiablePresentation === 'string' && encodedVerifiablePresentation.includes('~')) {
    const sdJwtVcApi = agentContext.dependencyManager.resolve(SdJwtVcApi)
    return sdJwtVcApi.fromCompact(encodedVerifiablePresentation)
  } else if (typeof encodedVerifiablePresentation === 'string') {
    return W3cJwtVerifiablePresentation.fromSerializedJwt(encodedVerifiablePresentation)
  } else if (typeof encodedVerifiablePresentation === 'object' && '@context' in encodedVerifiablePresentation) {
    return JsonTransformer.fromJSON(encodedVerifiablePresentation, W3cJsonLdVerifiablePresentation)
  } else {
    // TODO: WE NEED TO ADD SUPPORT FOR MDOC VERIFIABLE PRESENTATION
    throw new CredoError('Unsupported verifiable presentation format')
  }
}
