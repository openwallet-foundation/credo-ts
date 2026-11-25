import { CacheModuleConfig, EventEmitter, InMemoryLruCache } from '@credo-ts/core'
import {
  DidCommCredentialExchangeRecord,
  DidCommCredentialExchangeRepository,
  DidCommCredentialRole,
  DidCommCredentialState,
} from '@credo-ts/didcomm'
import { Subject } from 'rxjs'
import { InMemoryStorageService } from '../../../../../tests/InMemoryStorageService'
import { getAgentConfig, getAgentContext, getMockConnection } from '../../../../core/tests/helpers'
import { NativeAnoncreds } from '../../../tests/helpers'
import { AnonCredsModuleConfig } from '../../AnonCredsModuleConfig'
import type { AnonCredsRegistry } from '../../services'
import { AnonCredsDidCommRevocationNotificationFormatService } from '../AnonCredsDidCommRevocationNotificationFormatService'

describe('AnonCredsDidCommRevocationNotificationFormatService', () => {
  const connection = getMockConnection()
  const revocationRegistryId = 'did:indy:pool:localtest:TL1EaPFCZ8Si5aUrqScBDt/anoncreds/v0/REV_REG_DEF/1/My Registry'
  const encodedRevocationRegistryId =
    'did:indy:pool:localtest:TL1EaPFCZ8Si5aUrqScBDt/anoncreds/v0/REV_REG_DEF/1/My%20Registry'
  const indyRevocationRegistryId =
    'AsB27X6KRrJFsqZ3unNAH6:4:AsB27X6KRrJFsqZ3unNAH6:3:cl:48187:default:CL_ACCUM:3b24a9b0-a979-41e0-9964-2292f2b1b7e9'
  const credentialRevocationId = '1'
  const identifierVariantsRegistry = {
    supportedIdentifier: /^did:indy:/,
    getIdentifierVariants: (identifier: string) =>
      [revocationRegistryId, encodedRevocationRegistryId].includes(identifier)
        ? [revocationRegistryId, encodedRevocationRegistryId]
        : [identifier],
  } as AnonCredsRegistry
  let credentialRepository: DidCommCredentialExchangeRepository
  let credentialRecord: DidCommCredentialExchangeRecord
  let indyCredentialRecord: DidCommCredentialExchangeRecord
  let service: AnonCredsDidCommRevocationNotificationFormatService
  let agentContext: ReturnType<typeof getAgentContext>

  beforeEach(async () => {
    const agentConfig = getAgentConfig('AnonCredsRevocationNotificationFormatService')
    const eventEmitter = new EventEmitter(agentConfig.agentDependencies, new Subject())
    credentialRepository = new DidCommCredentialExchangeRepository(new InMemoryStorageService(), eventEmitter)
    agentContext = getAgentContext({
      registerInstances: [
        [CacheModuleConfig, new CacheModuleConfig({ cache: new InMemoryLruCache({ limit: 500 }) })],
        [
          AnonCredsModuleConfig,
          new AnonCredsModuleConfig({
            registries: [identifierVariantsRegistry],
            anoncreds: NativeAnoncreds,
          }),
        ],
        [DidCommCredentialExchangeRepository, credentialRepository],
      ],
    })
    credentialRecord = new DidCommCredentialExchangeRecord({
      threadId: 'thread-id',
      protocolVersion: 'v2',
      state: DidCommCredentialState.Done,
      role: DidCommCredentialRole.Holder,
      connectionId: connection.id,
    })
    credentialRecord.setTags({
      anonCredsRevocationRegistryId: revocationRegistryId,
      anonCredsCredentialRevocationId: credentialRevocationId,
    })
    await credentialRepository.save(agentContext, credentialRecord)
    indyCredentialRecord = new DidCommCredentialExchangeRecord({
      threadId: 'indy-thread-id',
      protocolVersion: 'v2',
      state: DidCommCredentialState.Done,
      role: DidCommCredentialRole.Holder,
      connectionId: connection.id,
    })
    indyCredentialRecord.setTags({
      anonCredsRevocationRegistryId: indyRevocationRegistryId,
      anonCredsCredentialRevocationId: credentialRevocationId,
    })
    await credentialRepository.save(agentContext, indyCredentialRecord)
    const issuerRecord = new DidCommCredentialExchangeRecord({
      threadId: 'issuer-thread-id',
      protocolVersion: 'v2',
      state: DidCommCredentialState.Done,
      role: DidCommCredentialRole.Issuer,
      connectionId: connection.id,
    })
    issuerRecord.setTags({
      anonCredsRevocationRegistryId: revocationRegistryId,
      anonCredsCredentialRevocationId: credentialRevocationId,
    })
    await credentialRepository.save(agentContext, issuerRecord)
    service = new AnonCredsDidCommRevocationNotificationFormatService()
  })

  test.each([
    ['anoncreds', `${revocationRegistryId}::${credentialRevocationId}`, 'record'],
    ['indy-anoncreds', `${indyRevocationRegistryId}::${credentialRevocationId}`, 'indyRecord'],
  ] as const)('finds a holder exchange for %s identifiers', async (revocationFormat, credentialId, recordType) => {
    const record = await service.findCredentialExchangeRecord(
      agentContext,
      credentialId,
      revocationFormat,
      connection.id
    )

    expect(record.id).toBe(recordType === 'record' ? credentialRecord.id : indyCredentialRecord.id)
  })

  test('finds an exchange when the notification uses another registry identifier variant', async () => {
    const record = await service.findCredentialExchangeRecord(
      agentContext,
      `${encodedRevocationRegistryId}::${credentialRevocationId}`,
      'anoncreds',
      connection.id
    )

    expect(record.id).toBe(credentialRecord.id)
  })

  test('builds credential ids for both AnonCreds formats from revocation tags', async () => {
    await expect(service.getCredentialId(agentContext, credentialRecord, 'anoncreds')).resolves.toBe(
      `${revocationRegistryId}::${credentialRevocationId}`
    )
    await expect(service.getCredentialId(agentContext, indyCredentialRecord, 'indy-anoncreds')).resolves.toBe(
      `${indyRevocationRegistryId}::${credentialRevocationId}`
    )
  })

  test('rejects unknown formats and identifiers that do not match the selected format', async () => {
    await expect(service.findCredentialExchangeRecord(agentContext, 'invalid', 'anoncreds')).rejects.toThrow(
      'Invalid anoncreds revocation credential id'
    )
    await expect(service.findCredentialExchangeRecord(agentContext, 'invalid', 'unknown')).rejects.toThrow(
      "Unsupported AnonCreds revocation format 'unknown'"
    )
  })

  test('does not build an identifier when the exchange has no revocation tags', async () => {
    const nonRevocableRecord = new DidCommCredentialExchangeRecord({
      threadId: 'non-revocable',
      protocolVersion: 'v2',
      state: DidCommCredentialState.Done,
      role: DidCommCredentialRole.Holder,
    })

    await expect(service.getCredentialId(agentContext, nonRevocableRecord, 'anoncreds')).rejects.toThrow(
      'does not contain AnonCreds revocation identifiers'
    )
  })

  test('does not build an identifier that does not match the selected format', async () => {
    await expect(service.getCredentialId(agentContext, credentialRecord, 'indy-anoncreds')).rejects.toThrow(
      "does not match AnonCreds revocation format 'indy-anoncreds'"
    )
  })
})
