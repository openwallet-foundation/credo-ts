import type { AgentContext } from '../../../agent'
import { Jwt } from '../../../crypto'
import { JsonTransformer } from '../../../utils'
import { MdocDeviceResponse } from '../../mdoc'
import { SdJwtVcApi } from '../../sd-jwt-vc'
import { W3cJsonLdVerifiablePresentation, W3cJwtVerifiablePresentation } from '../../vc'
import type { W3cJsonPresentation } from '../../vc/models/presentation/W3cJsonPresentation'

// TODO: we might want to move this to some generic vc transformation util
export function getVerifiablePresentationFromEncoded(
  agentContext: AgentContext,
  encodedVerifiablePresentation: string | W3cJsonPresentation
) {
  if (typeof encodedVerifiablePresentation === 'string' && encodedVerifiablePresentation.includes('~')) {
    const sdJwtVcApi = agentContext.dependencyManager.resolve(SdJwtVcApi)
    return sdJwtVcApi.fromCompact(encodedVerifiablePresentation)
  }
  if (typeof encodedVerifiablePresentation === 'string' && Jwt.format.test(encodedVerifiablePresentation)) {
    return W3cJwtVerifiablePresentation.fromSerializedJwt(encodedVerifiablePresentation)
  }
  if (typeof encodedVerifiablePresentation === 'object' && '@context' in encodedVerifiablePresentation) {
    return JsonTransformer.fromJSON(encodedVerifiablePresentation, W3cJsonLdVerifiablePresentation)
  }
  return MdocDeviceResponse.fromBase64Url(encodedVerifiablePresentation)
}
