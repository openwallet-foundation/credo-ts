import { Subject } from 'rxjs'
import type { Mock } from 'vitest'
import type { MockedClassConstructor } from '../../../../../../../../../tests/types'
import type { AnonCredsCredentialMetadata } from '../../../../../../../../anoncreds/src/index'
import type { AgentContext } from '../../../../../../../../core/src/agent'
import { EventEmitter } from '../../../../../../../../core/src/agent/EventEmitter'
import { verkeyToPublicJwk } from '../../../../../../../../core/src/modules/dids/helpers'
import type { DidRepository } from '../../../../../../../../core/src/modules/dids/repository'
import {
  getAgentConfig,
  getAgentContext,
  getMockConnection,
  mockFunction,
} from '../../../../../../../../core/tests/helpers'
import { DidCommMessage } from '../../../../../../DidCommMessage'
import { DidCommInboundMessageContext } from '../../../../../../models'
import { DidCommConnectionService, DidCommDidExchangeState } from '../../../../../connections'
import type { DidCommConnectionRepository } from '../../../../../connections/repository/DidCommConnectionRepository'
import { DidCommOutOfBandService } from '../../../../../oob/DidCommOutOfBandService'
import { DidCommOutOfBandRepository } from '../../../../../oob/repository/DidCommOutOfBandRepository'
import type { DidCommRevocationNotificationReceivedEvent } from '../../../../DidCommCredentialEvents'
import { DidCommCredentialEventTypes } from '../../../../DidCommCredentialEvents'
import { DidCommCredentialsModuleConfig } from '../../../../DidCommCredentialsModuleConfig'
import { DidCommCredentialRole, DidCommCredentialState } from '../../../../models'
import { DidCommCredentialExchangeRecord } from '../../../../repository'
import { DidCommCredentialExchangeRepository } from '../../../../repository/DidCommCredentialExchangeRepository'
import type { DidCommCredentialProtocol } from '../../../DidCommCredentialProtocol'
import { DidCommRevocationNotificationV1Message, DidCommRevocationNotificationV2Message } from '../../messages'
import { DidCommRevocationNotificationService } from '../DidCommRevocationNotificationService'

vi.mock('../../../../repository/DidCommCredentialExchangeRepository')
const CredentialRepositoryMock = DidCommCredentialExchangeRepository as MockedClassConstructor<
  typeof DidCommCredentialExchangeRepository
>
const credentialRepository = new CredentialRepositoryMock()

vi.mock('../../../../../oob/repository/DidCommOutOfBandRepository')
const OutOfBandRepositoryMock = DidCommOutOfBandRepository as MockedClassConstructor<typeof DidCommOutOfBandRepository>
const outOfBandRepository = new OutOfBandRepositoryMock()

vi.mock('../../../../../oob/DidCommOutOfBandService')
const OutOfBandServiceMock = DidCommOutOfBandService as MockedClassConstructor<typeof DidCommOutOfBandService>
const outOfBandService = new OutOfBandServiceMock()

const credentialProtocol = {
  version: 'v2',
  findCredentialMessage: vi.fn(),
  findRequestMessage: vi.fn(),
} as unknown as DidCommCredentialProtocol

const issuerVerkey = 'EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d'
const otherVerkey = '5UQ3drtEMMQXaLLmEywbciW92jZaQgRYgfuzXfonV8iz'
const holderVerkey = '6fioC1zcDPyPEL19pXRS2E4iJ46zH7xP6uSgAaPdwDrx'

const revocationRegistryId =
  'AsB27X6KRrJFsqZ3unNAH6:4:AsB27X6KRrJFsqZ3unNAH6:3:cl:48187:default:CL_ACCUM:3b24a9b0-a979-41e0-9964-2292f2b1b7e9'
const credentialRevocationId = '1'

const connection = getMockConnection({
  state: DidCommDidExchangeState.Completed,
})

describe('RevocationNotificationService', () => {
  let revocationNotificationService: DidCommRevocationNotificationService
  let agentContext: AgentContext
  let eventEmitter: EventEmitter
  let agentConfig: ReturnType<typeof getAgentConfig>

  beforeEach(() => {
    agentConfig = getAgentConfig('RevocationNotificationService')

    agentContext = getAgentContext({
      registerInstances: [
        [DidCommOutOfBandRepository, outOfBandRepository],
        [DidCommOutOfBandService, outOfBandService],
        [
          DidCommCredentialsModuleConfig,
          new DidCommCredentialsModuleConfig({ credentialProtocols: [credentialProtocol] }),
        ],
        [
          DidCommConnectionService,
          new DidCommConnectionService(
            agentConfig.logger,
            {} as DidCommConnectionRepository,
            {} as DidRepository,
            new EventEmitter(agentConfig.agentDependencies, new Subject())
          ),
        ],
      ],
    })

    eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())
    revocationNotificationService = new DidCommRevocationNotificationService(
      credentialRepository,
      eventEmitter,
      agentConfig.logger
    )
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('v1ProcessRevocationNotification', () => {
    test('emits revocation notification event if credential record exists for indy thread', async () => {
      const eventListenerMock = vi.fn()

      eventEmitter.on<DidCommRevocationNotificationReceivedEvent>(
        DidCommCredentialEventTypes.DidCommRevocationNotificationReceived,
        eventListenerMock
      )

      const date = new Date('2020-01-01T00:00:00.000Z')

      vi.useFakeTimers({ toFake: ['Date'], now: date })

      const credentialRecord = new DidCommCredentialExchangeRecord({
        threadId: 'thread-id',
        protocolVersion: 'v1',
        state: DidCommCredentialState.Done,
        role: DidCommCredentialRole.Holder,
      })

      const metadata = {
        revocationRegistryId:
          'AsB27X6KRrJFsqZ3unNAH6:4:AsB27X6KRrJFsqZ3unNAH6:3:cl:48187:default:CL_ACCUM:3b24a9b0-a979-41e0-9964-2292f2b1b7e9',
        credentialRevocationId: '1',
      } satisfies AnonCredsCredentialMetadata

      // Set required tags
      credentialRecord.setTag('anonCredsRevocationRegistryId', metadata.revocationRegistryId)
      credentialRecord.setTag('anonCredsCredentialRevocationId', metadata.credentialRevocationId)

      mockFunction(credentialRepository.getSingleByQuery).mockResolvedValueOnce(credentialRecord)

      const revocationNotificationThreadId = `indy::${metadata.revocationRegistryId}::${metadata.credentialRevocationId}`
      const revocationNotificationMessage = new DidCommRevocationNotificationV1Message({
        issueThread: revocationNotificationThreadId,
        comment: 'Credential has been revoked',
      })
      const messageContext = new DidCommInboundMessageContext(revocationNotificationMessage, {
        connection,
        agentContext,
      })

      await revocationNotificationService.v1ProcessRevocationNotification(messageContext)

      const clonedCredentialRecord = eventListenerMock.mock.calls[0][0].payload.credentialExchangeRecord
      expect(clonedCredentialRecord.toJSON()).toEqual(credentialRecord.toJSON())

      expect(credentialRecord.revocationNotification).toMatchObject({
        revocationDate: date,
        comment: 'Credential has been revoked',
      })

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'DidCommRevocationNotificationReceived',
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          credentialExchangeRecord: expect.any(DidCommCredentialExchangeRecord),
        },
      })

      vi.useRealTimers()
    })

    test('does not emit revocation notification event if no credential record exists for indy thread', async () => {
      const eventListenerMock = vi.fn()

      eventEmitter.on<DidCommRevocationNotificationReceivedEvent>(
        DidCommCredentialEventTypes.DidCommRevocationNotificationReceived,
        eventListenerMock
      )

      const revocationRegistryId =
        'ABC12D3EFgHIjKL4mnOPQ5:4:AsB27X6KRrJFsqZ3unNAH6:3:cl:48187:default:CL_ACCUM:3b24a9b0-a979-41e0-9964-2292f2b1b7e9'
      const credentialRevocationId = '2'
      const revocationNotificationThreadId = `indy::${revocationRegistryId}::${credentialRevocationId}`

      mockFunction(credentialRepository.getSingleByQuery).mockRejectedValueOnce(new Error('Could not find record'))

      const revocationNotificationMessage = new DidCommRevocationNotificationV1Message({
        issueThread: revocationNotificationThreadId,
        comment: 'Credential has been revoked',
      })
      const messageContext = new DidCommInboundMessageContext(revocationNotificationMessage, {
        connection,
        agentContext,
      })

      await revocationNotificationService.v1ProcessRevocationNotification(messageContext)

      expect(eventListenerMock).not.toHaveBeenCalled()
    })

    test('does not emit revocation notification event if invalid threadId is passed', async () => {
      const eventListenerMock = vi.fn()

      eventEmitter.on<DidCommRevocationNotificationReceivedEvent>(
        DidCommCredentialEventTypes.DidCommRevocationNotificationReceived,
        eventListenerMock
      )

      const revocationNotificationThreadId = 'notIndy::invalidRevRegId::invalidCredRevId'
      const revocationNotificationMessage = new DidCommRevocationNotificationV1Message({
        issueThread: revocationNotificationThreadId,
        comment: 'Credential has been revoked',
      })
      const messageContext = new DidCommInboundMessageContext(revocationNotificationMessage, { agentContext })

      await revocationNotificationService.v1ProcessRevocationNotification(messageContext)

      expect(eventListenerMock).not.toHaveBeenCalled()
    })
  })

  describe('v2ProcessRevocationNotification', () => {
    test('emits revocation notification event if credential record exists for indy thread', async () => {
      const eventListenerMock = vi.fn()

      eventEmitter.on<DidCommRevocationNotificationReceivedEvent>(
        DidCommCredentialEventTypes.DidCommRevocationNotificationReceived,
        eventListenerMock
      )

      const date = new Date('2020-01-01T00:00:00.000Z')

      vi.useFakeTimers({ toFake: ['Date'], now: date })

      const credentialRecord = new DidCommCredentialExchangeRecord({
        threadId: 'thread-id',
        protocolVersion: 'v2',
        state: DidCommCredentialState.Done,
        role: DidCommCredentialRole.Holder,
      })

      const metadata = {
        revocationRegistryId:
          'AsB27X6KRrJFsqZ3unNAH6:4:AsB27X6KRrJFsqZ3unNAH6:3:cl:48187:default:CL_ACCUM:3b24a9b0-a979-41e0-9964-2292f2b1b7e9',
        credentialRevocationId: '1',
      }

      mockFunction(credentialRepository.getSingleByQuery).mockResolvedValueOnce(credentialRecord)
      const revocationNotificationCredentialId = `${metadata.revocationRegistryId}::${metadata.credentialRevocationId}`

      const revocationNotificationMessage = new DidCommRevocationNotificationV2Message({
        credentialId: revocationNotificationCredentialId,
        revocationFormat: 'indy-anoncreds',
        comment: 'Credential has been revoked',
      })
      const messageContext = new DidCommInboundMessageContext(revocationNotificationMessage, {
        agentContext,
        connection,
      })

      await revocationNotificationService.v2ProcessRevocationNotification(messageContext)

      const clonedCredentialRecord = eventListenerMock.mock.calls[0][0].payload.credentialExchangeRecord
      expect(clonedCredentialRecord.toJSON()).toEqual(credentialRecord.toJSON())

      expect(credentialRecord.revocationNotification).toMatchObject({
        revocationDate: date,
        comment: 'Credential has been revoked',
      })

      expect(eventListenerMock).toHaveBeenCalledWith({
        type: 'DidCommRevocationNotificationReceived',
        metadata: {
          contextCorrelationId: 'mock',
        },
        payload: {
          credentialExchangeRecord: expect.any(DidCommCredentialExchangeRecord),
        },
      })

      vi.useRealTimers()
    })

    test('does not emit revocation notification event if no credential record exists for indy thread', async () => {
      const eventListenerMock = vi.fn()

      eventEmitter.on<DidCommRevocationNotificationReceivedEvent>(
        DidCommCredentialEventTypes.DidCommRevocationNotificationReceived,
        eventListenerMock
      )

      const revocationRegistryId =
        'ABC12D3EFgHIjKL4mnOPQ5:4:AsB27X6KRrJFsqZ3unNAH6:3:cl:48187:default:CL_ACCUM:3b24a9b0-a979-41e0-9964-2292f2b1b7e9'
      const credentialRevocationId = '2'
      const credentialId = `${revocationRegistryId}::${credentialRevocationId}`

      mockFunction(credentialRepository.getSingleByQuery).mockRejectedValueOnce(new Error('Could not find record'))

      const revocationNotificationMessage = new DidCommRevocationNotificationV2Message({
        credentialId,
        revocationFormat: 'indy-anoncreds',
        comment: 'Credential has been revoked',
      })
      const messageContext = new DidCommInboundMessageContext(revocationNotificationMessage, {
        connection,
        agentContext,
      })

      await revocationNotificationService.v2ProcessRevocationNotification(messageContext)

      expect(eventListenerMock).not.toHaveBeenCalled()
    })

    test('does not emit revocation notification event if invalid threadId is passed', async () => {
      const eventListenerMock = vi.fn()

      eventEmitter.on<DidCommRevocationNotificationReceivedEvent>(
        DidCommCredentialEventTypes.DidCommRevocationNotificationReceived,
        eventListenerMock
      )

      const invalidCredentialId = 'notIndy::invalidRevRegId::invalidCredRevId'
      const revocationNotificationMessage = new DidCommRevocationNotificationV2Message({
        credentialId: invalidCredentialId,
        revocationFormat: 'indy-anoncreds',
        comment: 'Credential has been revoked',
      })
      const messageContext = new DidCommInboundMessageContext(revocationNotificationMessage, { agentContext })

      await revocationNotificationService.v2ProcessRevocationNotification(messageContext)

      expect(eventListenerMock).not.toHaveBeenCalled()
    })
  })

  describe('connection-less revocation notification', () => {
    let eventListenerMock: Mock<(event: DidCommRevocationNotificationReceivedEvent) => void>
    let credentialRecord: DidCommCredentialExchangeRecord
    let warnSpy: Mock

    const messageWithService = (recipientKey: string) => {
      const message = new DidCommMessage()
      message.setService({ recipientKeys: [recipientKey], routingKeys: [], serviceEndpoint: 'rxjs:agent' })
      return message
    }

    beforeEach(() => {
      eventListenerMock = vi.fn()
      eventEmitter.on<DidCommRevocationNotificationReceivedEvent>(
        DidCommCredentialEventTypes.DidCommRevocationNotificationReceived,
        eventListenerMock
      )
      warnSpy = vi.spyOn(agentConfig.logger, 'warn') as unknown as Mock

      credentialRecord = new DidCommCredentialExchangeRecord({
        id: 'credential-record-id',
        threadId: 'thread-id',
        protocolVersion: 'v2',
        state: DidCommCredentialState.Done,
        role: DidCommCredentialRole.Holder,
      })
      credentialRecord.setTag('anonCredsRevocationRegistryId', revocationRegistryId)
      credentialRecord.setTag('anonCredsCredentialRevocationId', credentialRevocationId)

      mockFunction(credentialRepository.getSingleByQuery).mockResolvedValue(credentialRecord)
      mockFunction(outOfBandRepository.findSingleByQuery).mockResolvedValue(null)
      mockFunction(credentialProtocol.findCredentialMessage).mockResolvedValue(messageWithService(issuerVerkey))
      mockFunction(credentialProtocol.findRequestMessage).mockResolvedValue(messageWithService(holderVerkey))
    })

    const v1Message = () =>
      new DidCommRevocationNotificationV1Message({
        issueThread: `indy::${revocationRegistryId}::${credentialRevocationId}`,
        comment: 'Credential has been revoked',
      })
    const v2Message = () =>
      new DidCommRevocationNotificationV2Message({
        credentialId: `${revocationRegistryId}::${credentialRevocationId}`,
        revocationFormat: 'anoncreds',
        comment: 'Credential has been revoked',
      })

    const process = async (
      version: 'v1' | 'v2',
      {
        senderVerkey,
        recipientVerkey = holderVerkey,
        serviceVerkey = issuerVerkey,
      }: { senderVerkey?: string; recipientVerkey?: string; serviceVerkey?: string } = {}
    ) => {
      const options = {
        agentContext,
        senderKey: senderVerkey ? verkeyToPublicJwk(senderVerkey) : undefined,
        recipientKey: verkeyToPublicJwk(recipientVerkey),
      }
      const service = { recipientKeys: [serviceVerkey], routingKeys: [], serviceEndpoint: 'rxjs:issuer' }
      if (version === 'v1') {
        const message = v1Message()
        message.setService(service)
        await revocationNotificationService.v1ProcessRevocationNotification(
          new DidCommInboundMessageContext(message, options)
        )
      } else {
        const message = v2Message()
        message.setService(service)
        await revocationNotificationService.v2ProcessRevocationNotification(
          new DidCommInboundMessageContext(message, options)
        )
      }
    }

    const expectRefused = (reason: string) => {
      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to process revocation notification message',
        expect.objectContaining({ error: expect.objectContaining({ message: expect.stringContaining(reason) }) })
      )
      expect(credentialRecord.revocationNotification).toBeUndefined()
      expect(credentialRepository.update).not.toHaveBeenCalled()
      expect(eventListenerMock).not.toHaveBeenCalled()
    }

    test.each(['v1', 'v2'] as const)('%s accepts a notification authcrypted with the issuer key', async (version) => {
      await process(version, { senderVerkey: issuerVerkey })

      expect(credentialRepository.getSingleByQuery).toHaveBeenCalledWith(agentContext, {
        anonCredsRevocationRegistryId: revocationRegistryId,
        anonCredsCredentialRevocationId: credentialRevocationId,
        role: DidCommCredentialRole.Holder,
      })
      expect(credentialProtocol.findCredentialMessage).toHaveBeenCalledWith(agentContext, credentialRecord.id)
      expect(credentialProtocol.findRequestMessage).toHaveBeenCalledWith(agentContext, credentialRecord.id)
      expect(credentialRecord.revocationNotification).toMatchObject({ comment: 'Credential has been revoked' })
      expect(credentialRepository.update).toHaveBeenCalledWith(agentContext, credentialRecord)
      expect(eventListenerMock).toHaveBeenCalledTimes(1)
    })

    test.each(['v1', 'v2'] as const)(
      '%s without a connection refuses a credential received over a connection',
      async (version) => {
        credentialRecord.connectionId = connection.id

        await process(version, { senderVerkey: issuerVerkey })

        expectRefused(`Expected incoming message to be from connection ${connection.id} but no connection found.`)
      }
    )

    test.each(['v1', 'v2'] as const)('%s refuses a notification authcrypted with another key', async (version) => {
      await process(version, { senderVerkey: otherVerkey })

      expectRefused('not found in their service')
    })

    test.each(['v1', 'v2'] as const)(
      '%s refuses a notification whose own ~service holds the key it was authcrypted with',
      async (version) => {
        await process(version, { senderVerkey: otherVerkey, serviceVerkey: otherVerkey })

        expectRefused('not found in the ~service of credential message')
      }
    )

    test.each(['v1', 'v2'] as const)(
      '%s refuses a notification when the credential message has no ~service',
      async (version) => {
        mockFunction(credentialProtocol.findCredentialMessage).mockResolvedValue(new DidCommMessage())

        await process(version, { senderVerkey: issuerVerkey })

        expectRefused('not found in the ~service of credential message')
      }
    )

    test.each(['v1', 'v2'] as const)('%s refuses an anoncrypted notification', async (version) => {
      await process(version)

      expectRefused('Incoming message must have recipientKey and senderKey')
    })

    test.each(['v1', 'v2'] as const)(
      '%s refuses a notification encrypted to a key that is not in our request ~service',
      async (version) => {
        await process(version, { senderVerkey: issuerVerkey, recipientVerkey: otherVerkey })

        expectRefused('not found in our service')
      }
    )

    test.each(['v1', 'v2'] as const)(
      '%s refuses a notification when no credential message is stored',
      async (version) => {
        mockFunction(credentialProtocol.findCredentialMessage).mockResolvedValue(null)

        await process(version, { senderVerkey: issuerVerkey })

        expectRefused('No credential message found')
      }
    )

    test.each(['v1', 'v2'] as const)('%s with a connection does not check the sender key', async (version) => {
      const options = { agentContext, connection, senderKey: verkeyToPublicJwk(otherVerkey) }
      if (version === 'v1') {
        await revocationNotificationService.v1ProcessRevocationNotification(
          new DidCommInboundMessageContext(v1Message(), options)
        )
      } else {
        await revocationNotificationService.v2ProcessRevocationNotification(
          new DidCommInboundMessageContext(v2Message(), options)
        )
      }

      expect(credentialRepository.getSingleByQuery).toHaveBeenCalledWith(agentContext, {
        anonCredsRevocationRegistryId: revocationRegistryId,
        anonCredsCredentialRevocationId: credentialRevocationId,
        connectionId: connection.id,
      })
      expect(credentialProtocol.findCredentialMessage).not.toHaveBeenCalled()
      expect(eventListenerMock).toHaveBeenCalledTimes(1)
    })
  })
})
