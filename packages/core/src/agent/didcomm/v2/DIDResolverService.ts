import type { VerificationMethod, DidDocumentService } from '../../../modules/dids/domain'
import type { AgentContext } from '../../context'
import type { DIDDoc, DIDResolver } from 'didcomm'

import { InjectionSymbols } from '../../../constants'
import { AriesFrameworkError } from '../../../error'
import { DidCommV1Service, DidCommV2Service, IndyAgentService } from '../../../modules/dids/domain'
import { DidResolverService } from '../../../modules/dids/services/DidResolverService'
import { inject, injectable } from '../../../plugins'
import { AgentContextProvider } from '../../context'

@injectable()
export class DIDResolverService implements DIDResolver {
  private agentContext: AgentContext | undefined
  private agentContextProvider: AgentContextProvider
  private resolverService: DidResolverService

  public constructor(
    @inject(InjectionSymbols.AgentContextProvider) agentContextProvider: AgentContextProvider,
    resolverService: DidResolverService
  ) {
    this.agentContextProvider = agentContextProvider
    this.resolverService = resolverService
  }

  // FIXME: Find better way for managing agent context
  public bindAgentContext(agentContext: AgentContext): DIDResolverService {
    this.agentContext = agentContext
    return this
  }

  public async resolve(did: string): Promise<DIDDoc | null> {
    // FIXME: Relates to above fixme about agent context
    const agentContext = this.agentContext ?? (await this.agentContextProvider.getDefaultAgentContext())
    const result = await this.resolverService.resolve(agentContext, did)
    if (!result.didDocument) {
      throw new AriesFrameworkError(`Unable to resolve DIDDoc for ${did}`)
    }

    const verificationMethods = result.didDocument.verificationMethod?.map((verificationMethod) =>
      DIDResolverService.mapVerificationMethod(verificationMethod)
    )

    const services = result.didDocument.service?.map((service) => DIDResolverService.mapService(service))

    const didDod: DIDDoc = {
      did: result.didDocument.id,
      verification_methods: verificationMethods || [],
      services: services || [],
      key_agreements: [],
      authentications: [],
    }

    const keyAgreements = result.didDocument.keyAgreement || []
    for (const keyAgreement of keyAgreements) {
      if (typeof keyAgreement === 'string') {
        didDod.key_agreements.push(keyAgreement)
      } else {
        didDod.key_agreements.push(keyAgreement.id)
        didDod.verification_methods.push(DIDResolverService.mapVerificationMethod(keyAgreement))
      }
    }

    const authentications = result.didDocument.authentication || []
    for (const authentication of authentications) {
      if (typeof authentication === 'string') {
        didDod.authentications.push(authentication)
      } else {
        didDod.authentications.push(authentication.id)
        didDod.verification_methods.push(DIDResolverService.mapVerificationMethod(authentication))
      }
    }

    return didDod
  }

  private static mapVerificationMethod(verificationMethod: VerificationMethod) {
    return {
      id: verificationMethod.id,
      type: verificationMethod.type,
      controller: verificationMethod.controller,
      verification_material: verificationMethod.publicKeyBase58
        ? { format: 'Base58', value: verificationMethod.publicKeyBase58 }
        : verificationMethod.publicKeyMultibase
        ? { format: 'Multibase', value: verificationMethod.publicKeyMultibase }
        : verificationMethod.publicKeyHex
        ? { format: 'Hex', value: verificationMethod.publicKeyHex }
        : verificationMethod.publicKeyJwk
        ? { format: 'JWK', value: verificationMethod.publicKeyJwk }
        : {
            format: 'Other',
            value:
              verificationMethod.publicKeyPem ||
              verificationMethod.publicKeyBase64 ||
              verificationMethod.blockchainAccountId ||
              verificationMethod.ethereumAddress,
          },
    }
  }

  private static mapService(service: DidDocumentService) {
    return {
      id: service.id,
      kind:
        service instanceof DidCommV2Service
          ? {
              DIDCommMessaging: {
                service_endpoint: service.serviceEndpoint,
                accept: service.accept ?? [],
                routing_keys: service.routingKeys ?? [],
              },
            }
          : service instanceof DidCommV1Service
          ? {
              Other: {
                type: service.type,
                serviceEndpoint: service.serviceEndpoint,
                recipientKeys: service.recipientKeys || [],
                routingKeys: service.routingKeys,
                accept: service.accept,
                priority: service.priority,
              },
            }
          : service instanceof IndyAgentService
          ? {
              Other: {
                type: service.type,
                serviceEndpoint: service.serviceEndpoint,
                recipientKeys: service.recipientKeys,
                routingKeys: service.routingKeys,
                priority: service.priority,
              },
            }
          : {
              Other: {
                type: service.type,
                serviceEndpoint: service.serviceEndpoint,
              },
            },
    }
  }
}
