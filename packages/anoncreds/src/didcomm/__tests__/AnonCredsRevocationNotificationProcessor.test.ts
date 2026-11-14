import type { AgentContext } from '@credo-ts/core'
import { CacheModuleConfig, EventEmitter, InMemoryLruCache } from '@credo-ts/core'
import type { DidCommRevocationNotificationReceivedEvent } from '@credo-ts/didcomm'
import {
  DidCommCredentialEventTypes,
  DidCommCredentialExchangeRecord,
  DidCommCredentialExchangeRepository,
  DidCommCredentialRole,
  DidCommCredentialState,
  DidCommDidExchangeState,
  DidCommInboundMessageContext,
  DidCommRevocationNotification,
} from '@credo-ts/didcomm'
import { Subject } from 'rxjs'
import { InMemoryStorageService } from '../../../../../tests/InMemoryStorageService'
import { getAgentConfig, getAgentContext, getMockConnection } from '../../../../core/tests/helpers'
import { AnonCredsRevocationNotificationProcessor } from '../AnonCredsRevocationNotificationProcessor'
import {
  DidCommRevocationNotificationV1Message,
  DidCommRevocationNotificationV2Message,
} from '../revocation-notification/messages'

const connection = getMockConnection({ state: DidCommDidExchangeState.Completed })

describe('AnonCredsRevocationNotificationProcessor', () => {
  let processor: AnonCredsRevocationNotificationProcessor
  let agentContext: AgentContext
  let eventEmitter: EventEmitter
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    const agentConfig = getAgentConfig('AnonCredsRevocationNotificationProcessor')
    warnSpy = vi.spyOn(agentConfig.logger, 'warn')
    agentContext = getAgentContext({
      registerInstances: [
        [
          CacheModuleConfig,
          new CacheModuleConfig({
            cache: new InMemoryLruCache({ limit: 500 }),
          }),
        ],
      ],
    })

    eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())
    const credentialRepository = new DidCommCredentialExchangeRepository(new InMemoryStorageService(), eventEmitter)
    agentContext.dependencyManager.registerInstance(DidCommCredentialExchangeRepository, credentialRepository)
    processor = new AnonCredsRevocationNotificationProcessor(credentialRepository, eventEmitter, agentConfig.logger)
  })

  test('processes an AnonCreds V2 notification for a matching credential record', async () => {
    const eventListener = vi.fn()
    eventEmitter.on<DidCommRevocationNotificationReceivedEvent>(
      DidCommCredentialEventTypes.DidCommRevocationNotificationReceived,
      eventListener
    )

    const revocationRegistryId = 'did:indy:pool:localtest:TL1EaPFCZ8Si5aUrqScBDt/anoncreds/v0/REV_REG_DEF/1/My Registry'
    const credentialRevocationId = '1'
    const credentialRecord = new DidCommCredentialExchangeRecord({
      threadId: 'thread-id',
      protocolVersion: 'v1',
      state: DidCommCredentialState.Done,
      role: DidCommCredentialRole.Holder,
    })
    credentialRecord.connectionId = connection.id
    credentialRecord.setTag('anonCredsRevocationRegistryId', revocationRegistryId)
    credentialRecord.setTag('anonCredsCredentialRevocationId', credentialRevocationId)
    const credentialRepository = agentContext.dependencyManager.resolve(DidCommCredentialExchangeRepository)
    await credentialRepository.save(agentContext, credentialRecord)

    const messageContext = new DidCommInboundMessageContext(
      new DidCommRevocationNotificationV2Message({
        credentialId: `${revocationRegistryId}::${credentialRevocationId}`,
        revocationFormat: 'anoncreds',
        comment: 'Credential has been revoked',
      }),
      { connection, agentContext }
    )

    await processor.processV2(messageContext)

    expect(warnSpy).not.toHaveBeenCalled()
    const updatedRecord = await credentialRepository.getById(agentContext, credentialRecord.id)
    expect(updatedRecord.revocationNotification).toBeInstanceOf(DidCommRevocationNotification)
    expect(updatedRecord.revocationNotification?.comment).toBe('Credential has been revoked')
    expect(eventListener).toHaveBeenCalledTimes(1)
  })

  test('supports legacy Indy V1 registry identifiers', async () => {
    const credentialRecord = new DidCommCredentialExchangeRecord({
      threadId: 'thread-id',
      protocolVersion: 'v1',
      state: DidCommCredentialState.Done,
      role: DidCommCredentialRole.Holder,
    })
    const revocationRegistryId =
      'AsB27X6KRrJFsqZ3unNAH6:4:AsB27X6KRrJFsqZ3unNAH6:3:cl:48187:default:CL_ACCUM:3b24a9b0-a979-41e0-9964-2292f2b1b7e9'
    credentialRecord.connectionId = connection.id
    credentialRecord.setTag('anonCredsRevocationRegistryId', revocationRegistryId)
    credentialRecord.setTag('anonCredsCredentialRevocationId', '1')
    const credentialRepository = agentContext.dependencyManager.resolve(DidCommCredentialExchangeRepository)
    await credentialRepository.save(agentContext, credentialRecord)

    const messageContext = new DidCommInboundMessageContext(
      new DidCommRevocationNotificationV1Message({
        issueThread: `indy::${revocationRegistryId}::1`,
      }),
      { connection, agentContext }
    )

    await processor.processV1(messageContext)

    expect(warnSpy).not.toHaveBeenCalled()
    const updatedRecord = await credentialRepository.getById(agentContext, credentialRecord.id)
    expect(updatedRecord.revocationNotification).toBeInstanceOf(DidCommRevocationNotification)
  })
})
