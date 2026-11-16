import { getAgentOptions } from '../../../../tests'
import { Agent } from '../../../agent/Agent'
import { JsonTransformer } from '../../../utils'
import { addCredentialHolderBindingDids } from '../../../utils/credentialHolderBinding'
import type { KeyDidCreateOptions } from '../../dids'
import { JsonLdModule } from '../jsonld'
import { W3cJsonLdVerifiableCredential } from '../linked-data-proofs'
import { customDocumentLoader } from '../linked-data-proofs/__tests__/documentLoader'
import { Ed25519Signature2018Fixtures } from '../linked-data-proofs/__tests__/fixtures'
import { W3cCredentialRecord, W3cCredentialRepository } from '../repository'
import { W3cCredentialService } from '../W3cCredentialService'

const agentOptions = getAgentOptions(
  'W3cCredentialsApi',
  {},
  {},
  {
    jsonLd: new JsonLdModule({
      documentLoader: customDocumentLoader,
    }),
  }
)

const agent = new Agent(agentOptions)

let w3cCredentialRepository: W3cCredentialRepository
let w3cCredentialService: W3cCredentialService

const testCredential = JsonTransformer.fromJSON(
  Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
  W3cJsonLdVerifiableCredential
)

describe('W3cCredentialsApi', () => {
  beforeAll(() => {
    w3cCredentialRepository = agent.dependencyManager.resolve(W3cCredentialRepository)
    w3cCredentialService = agent.dependencyManager.resolve(W3cCredentialService)
  })

  beforeEach(async () => {
    await agent.initialize()
  })

  afterEach(async () => {
    // TOOD: we probably need a way to delete a context on the agent,
    // for tenants we do it on the tenants api, for the main context
    //  we can do it on the agent instance? So `agent.delete()` maybe?
    await agent.dependencyManager.registeredModules.inMemory.onDeleteContext?.(agent.context)
    await agent.shutdown()
  })

  it('Should successfully store a credential', async () => {
    const repoSpy = vi.spyOn(w3cCredentialRepository, 'save')
    const serviceSpy = vi.spyOn(w3cCredentialService, 'storeCredential')

    await agent.w3cCredentials.store({
      record: new W3cCredentialRecord({
        credentialInstances: [
          {
            credential: testCredential.jsonCredential,
          },
        ],
        tags: {},
      }),
    })

    expect(repoSpy).toHaveBeenCalledTimes(1)
    expect(serviceSpy).toHaveBeenCalledTimes(1)
  })

  it('Should successfully retrieve a credential by id', async () => {
    const repoSpy = vi.spyOn(w3cCredentialRepository, 'getById')
    const serviceSpy = vi.spyOn(w3cCredentialService, 'getCredentialRecordById')

    const storedCredential = await agent.w3cCredentials.store({
      record: W3cCredentialRecord.fromCredential(testCredential),
    })

    const retrievedCredential = await agent.w3cCredentials.getById(storedCredential.id)
    expect(storedCredential.id).toEqual(retrievedCredential.id)

    expect(repoSpy).toHaveBeenCalledTimes(1)
    expect(repoSpy).toHaveBeenCalledWith(agent.context, storedCredential.id)
    expect(serviceSpy).toHaveBeenCalledTimes(1)
  })

  it('Should successfully remove a credential by id', async () => {
    const repoSpy = vi.spyOn(w3cCredentialRepository, 'delete')
    const serviceSpy = vi.spyOn(w3cCredentialService, 'removeCredentialRecord')

    const storedCredential = await agent.w3cCredentials.store({
      record: W3cCredentialRecord.fromCredential(testCredential),
    })

    await agent.w3cCredentials.deleteById(storedCredential.id)

    expect(repoSpy).toHaveBeenCalledTimes(1)
    expect(serviceSpy).toHaveBeenCalledTimes(1)
    expect(serviceSpy).toHaveBeenCalledWith(agent.context, storedCredential.id, undefined)

    const allCredentials = await agent.w3cCredentials.getAll()
    expect(allCredentials).toHaveLength(0)
  })

  it('deletes the DIDs created for the credential only when asked', async () => {
    const store = async () => {
      const { didState } = await agent.dids.create<KeyDidCreateOptions>({
        method: 'key',
        options: { createKey: { type: { kty: 'OKP', crv: 'Ed25519' } } },
      })
      const did = didState.did as string
      const [didRecord] = await agent.dids.getCreatedDids({ did })
      const record = W3cCredentialRecord.fromCredential(testCredential)
      addCredentialHolderBindingDids(record, [did])
      await agent.w3cCredentials.store({ record })
      return { record, did, keyId: didRecord.keys?.[0].kmsKeyId as string }
    }

    const kept = await store()
    await agent.w3cCredentials.deleteById(kept.record.id)
    expect(await agent.dids.getCreatedDids({ did: kept.did })).toHaveLength(1)
    await expect(agent.kms.getPublicKey({ keyId: kept.keyId })).resolves.toBeDefined()

    const deleted = await store()
    await agent.w3cCredentials.deleteById(deleted.record.id, { deleteAssociatedKeys: true })
    expect(await agent.dids.getCreatedDids({ did: deleted.did })).toHaveLength(0)
    await expect(agent.kms.getPublicKey({ keyId: deleted.keyId })).rejects.toThrow('not found')
  })
})
