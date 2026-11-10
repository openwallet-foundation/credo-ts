import { EventEmitter } from 'node:events'
import { Agent, DependencyManager, InjectionSymbols, JsonTransformer, W3cCredentialRepository } from '@credo-ts/core'
import { WebSocket } from 'ws'
import { InMemoryStorageService } from '../../../../tests/InMemoryStorageService'
import { NodeFileSystem } from '../../../node/src/NodeFileSystem'
import { NativeAnoncreds } from '../../tests/helpers'
import { InMemoryAnonCredsRegistry } from '../../tests/InMemoryAnonCredsRegistry'
import { AnonCredsCredentialRecord, AnonCredsCredentialRepository, AnonCredsModule } from '../index'

vi.mock('@credo-ts/didcomm', () => {
  throw new Error('DIDComm is not installed')
})

function createAgent() {
  const schemaId = 'urn:example:schema'
  const schema = {
    name: 'Example',
    version: '1.0',
    issuerId: 'did:example:issuer',
    attrNames: ['name'],
  }
  const storage = new InMemoryStorageService()
  const dependencyManager = new DependencyManager()
  dependencyManager.registerInstance(InjectionSymbols.StorageService, storage)

  const module = new AnonCredsModule({
    anoncreds: NativeAnoncreds,
    registries: [new InMemoryAnonCredsRegistry({ existingSchemas: { [schemaId]: schema } })],
  })
  const agent = new Agent(
    {
      dependencies: { FileSystem: NodeFileSystem, EventEmitterClass: EventEmitter, WebSocketClass: WebSocket, fetch },
      modules: { anoncreds: module },
    },
    dependencyManager
  )
  storage.createRecordsForContext(agent.context)

  return { agent, module, schemaId, schema }
}

describe('AnonCreds without DIDComm', () => {
  test('does not load DIDComm when there are no legacy credentials to convert', async () => {
    const { agent, module } = createAgent()

    await expect(module.updates[1].doUpdate(agent)).resolves.toBeUndefined()
  })

  test('requires DIDComm on demand for the legacy exchange-record migration', async () => {
    const { agent, module } = createAgent()

    await expect(module.updates[0].doUpdate(agent)).rejects.toMatchObject({
      cause: expect.objectContaining({ message: 'DIDComm is not installed' }),
    })
  })

  test('fails before writing or deleting legacy credentials if DIDComm cannot load', async () => {
    const { agent, module } = createAgent()
    const repository = agent.dependencyManager.resolve(AnonCredsCredentialRepository)
    agent.dependencyManager.registerInstance(AnonCredsCredentialRepository, repository)
    const record = JsonTransformer.fromJSON({ id: 'legacy' }, AnonCredsCredentialRecord)
    vi.spyOn(repository, 'getAll').mockResolvedValue([record])
    const deleteRecord = vi.spyOn(repository, 'delete')
    const save = vi.spyOn(agent.dependencyManager.resolve(W3cCredentialRepository), 'save')

    await expect(module.updates[1].doUpdate(agent)).rejects.toMatchObject({
      cause: expect.objectContaining({ message: 'DIDComm is not installed' }),
    })
    expect(deleteRecord).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })
})
