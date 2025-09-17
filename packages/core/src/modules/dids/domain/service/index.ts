import { DidCommV1Service } from './DidCommV1Service'
import { DidCommV2Service, DidCommV2ServiceEndpoint, DidCommV2ServiceEndpointOptions } from './DidCommV2Service'
import { DidDocumentService } from './DidDocumentService'
import { IndyAgentService } from './IndyAgentService'
import { ServiceTransformer, serviceTypes } from './ServiceTransformer'

export {
  LegacyDidCommV2ServiceOptions as DidCommV2ServiceOptions,
  LegacyDidCommV2Service as DidCommV2Service,
} from './LegacyDidCommV2Service'

export {
  IndyAgentService,
  DidCommV1Service,
  DidDocumentService,
  ServiceTransformer,
  serviceTypes,
  DidCommV2Service as NewDidCommV2Service,
  DidCommV2ServiceEndpoint as NewDidCommV2ServiceEndpoint,
  DidCommV2ServiceEndpointOptions as NewDidCommV2ServiceEndpointOptions,
}
