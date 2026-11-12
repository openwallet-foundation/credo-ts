import { EventEmitter } from 'node:events'
import {
  Agent,
  DependencyManager,
  InjectionSymbols,
  W3cCredentialService,
  W3cJsonLdVerifiableCredential,
} from '@credo-ts/core'
import { WebSocket } from 'ws'
import { InMemoryStorageService } from '../../../../tests/InMemoryStorageService'
import { NodeFileSystem } from '../../../node/src/NodeFileSystem'
import { NativeAnoncreds } from '../../tests/helpers'
import { InMemoryAnonCredsRegistry } from '../../tests/InMemoryAnonCredsRegistry'
import { AnonCredsCredentialRecord, AnonCredsCredentialRepository, AnonCredsModule } from '../index'
import { type AnonCredsHolderService, AnonCredsHolderServiceSymbol } from '../services'
import { migrateCredentialExchangeRecordToV0_4 } from '../updates/0.3.1-0.4/credentialExchangeRecord'
import { storeAnonCredsInW3cFormatV0_5 } from '../updates/0.4-0.5/anonCredsCredentialRecord'

vi.mock('@credo-ts/didcomm', () => {
  const error = Object.assign(new Error("Cannot find package '@credo-ts/didcomm'"), {
    code: 'ERR_MODULE_NOT_FOUND',
  })
  throw error
})

function createAgent() {
  const dependencyManager = new DependencyManager()
  const storage = new InMemoryStorageService()
  dependencyManager.registerInstance(InjectionSymbols.StorageService, storage)

  const module = new AnonCredsModule({
    anoncreds: NativeAnoncreds,
    registries: [new InMemoryAnonCredsRegistry()],
  })
  const agent = new Agent(
    {
      dependencies: { FileSystem: NodeFileSystem, EventEmitterClass: EventEmitter, WebSocketClass: WebSocket, fetch },
      modules: { anoncreds: module },
    },
    dependencyManager
  )
  storage.createRecordsForContext(agent.context)

  return { agent }
}

describe('AnonCreds without DIDComm', () => {
  test('skips the DIDComm-only 0.3.1 to 0.4 migration when DIDComm is not installed', async () => {
    const { agent } = createAgent()
    const warn = vi.spyOn(agent.config.logger, 'warn')

    await expect(migrateCredentialExchangeRecordToV0_4(agent)).resolves.toBeUndefined()

    expect(warn).toHaveBeenCalledWith(
      'Skipping credential exchange record migration to storage version 0.4 because @credo-ts/didcomm is not installed.'
    )
  })

  test('converts legacy AnonCreds credentials when DIDComm is not installed', async () => {
    const { agent } = createAgent()
    const legacyRecord = new AnonCredsCredentialRecord({
      id: 'legacy-record',
      credentialId: 'legacy-credential',
      credential: {
        schema_id: 'urn:example:schema',
        cred_def_id: 'urn:example:credential-definition',
        values: { name: { raw: 'Alice', encoded: '123' } },
        signature: {},
        signature_correctness_proof: {},
      },
      linkSecretId: 'link-secret',
      methodName: 'indy',
      schemaName: 'example',
      schemaVersion: '1.0',
      schemaIssuerId: 'did:example:issuer',
      issuerId: 'did:example:issuer',
    })
    const anonCredsRepository = agent.dependencyManager.resolve(AnonCredsCredentialRepository)
    await anonCredsRepository.save(agent.context, legacyRecord)

    const holderService = agent.dependencyManager.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)
    vi.spyOn(holderService, 'legacyToW3cCredential').mockResolvedValue(
      new W3cJsonLdVerifiableCredential({
        issuer: 'did:example:issuer',
        type: ['VerifiableCredential'],
        issuanceDate: '2024-01-01T00:00:00Z',
        credentialSubject: { claims: { name: 'Alice' } },
        proof: {
          type: 'Ed25519Signature2018',
          proofPurpose: 'assertionMethod',
          verificationMethod: 'did:example:issuer#key-1',
          created: '2024-01-01T00:00:00Z',
          proofValue: 'z',
        },
      })
    )
    const storeCredential = vi
      .spyOn(agent.dependencyManager.resolve(W3cCredentialService), 'storeCredential')
      .mockImplementation(async (_agentContext, { record }) => record)
    const warn = vi.spyOn(agent.config.logger, 'warn')

    await expect(storeAnonCredsInW3cFormatV0_5(agent)).resolves.toBeUndefined()

    expect(storeCredential).toHaveBeenCalledTimes(1)
    await expect(anonCredsRepository.getAll(agent.context)).resolves.toHaveLength(0)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('legacy AnonCreds credential record legacy-record'))
  })
})
