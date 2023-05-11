import type { DidDocumentService } from '@aries-framework/core'
import type { DIDDoc, DIDResolver } from 'didcomm'

import {
  injectable,
  AgentContext,
  DidResolverService,
  DidCommV2Service,
  IndyAgentService,
  DidCommV1Service,
} from '@aries-framework/core'

@injectable()
export class DidCommV2DidResolver implements DIDResolver {
  private agentContext: AgentContext
  private didResolverService: DidResolverService

  public constructor(agentContext: AgentContext, didResolverService: DidResolverService) {
    this.agentContext = agentContext
    this.didResolverService = didResolverService
  }

  public async resolve(did: string): Promise<DIDDoc | null> {
    const result = await this.didResolverService.resolve(this.agentContext, did)
    if (!result.didDocument) {
      return null
    }

    const services = result.didDocument.service?.map((service) => DidCommV2DidResolver.mapService(service))

    const didDod: DIDDoc = {
      id: result.didDocument.id,
      verificationMethod: result.didDocument.verificationMethod || [],
      service: services || [],
      keyAgreement: [],
      authentication: [],
    }

    const keyAgreements = result.didDocument.keyAgreement || []
    for (const keyAgreement of keyAgreements) {
      if (typeof keyAgreement === 'string') {
        didDod.keyAgreement.push(keyAgreement)
      } else {
        didDod.keyAgreement.push(keyAgreement.id)
        didDod.verificationMethod.push(keyAgreement)
      }
    }

    const authentications = result.didDocument.authentication || []
    for (const authentication of authentications) {
      if (typeof authentication === 'string') {
        didDod.authentication.push(authentication)
      } else {
        didDod.authentication.push(authentication.id)
        didDod.verificationMethod.push(authentication)
      }
    }

    return didDod
  }

  private static mapService(service: DidDocumentService) {
    if (service instanceof DidCommV2Service) {
      return {
        id: service.id,
        type: 'DIDCommMessaging',
        serviceEndpoint: {
          uri: service.serviceEndpoint,
          accept: service.accept ?? [],
          routingKeys: service.routingKeys ?? [],
        },
      }
    } else if (service instanceof DidCommV1Service) {
      return {
        id: service.id,
        type: 'DIDCommMessaging',
        serviceEndpoint: {
          uri: service.serviceEndpoint,
          accept: service.accept ?? [],
          routingKeys: service.routingKeys ?? [],
        },
      }
    } else {
      return {
        id: service.id,
        type: 'DIDCommMessaging',
        serviceEndpoint: {
          uri: service.serviceEndpoint,
        },
      }
    }
  }
}
