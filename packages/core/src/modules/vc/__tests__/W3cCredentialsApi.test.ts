import { getAgentOptions } from '../../../../tests'
import { Agent } from '../../../agent/Agent'
import { JsonTransformer } from '../../../utils'
import { W3cCredentialService } from '../W3cCredentialService'
import { W3cCredentialsModule } from '../W3cCredentialsModule'
import { customDocumentLoader } from '../data-integrity/__tests__/documentLoader'
import { Ed25519Signature2018Fixtures } from '../data-integrity/__tests__/fixtures'
import { W3cJsonLdVerifiableCredential } from '../data-integrity/models'
import { W3cCredentialRepository } from '../repository'

const agentOptions = getAgentOptions(
  'W3cCredentialsApi',
  {},
  {},
  {
    w3cCredentials: new W3cCredentialsModule({
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

    await agent.w3cCredentials.storeCredential({
      credential: testCredential,
    })

    expect(repoSpy).toHaveBeenCalledTimes(1)
    expect(serviceSpy).toHaveBeenCalledTimes(1)
  })

  it('Should successfully retrieve a credential by id', async () => {
    const repoSpy = vi.spyOn(w3cCredentialRepository, 'getById')
    const serviceSpy = vi.spyOn(w3cCredentialService, 'getCredentialRecordById')

    const storedCredential = await agent.w3cCredentials.storeCredential({
      credential: testCredential,
    })

    const retrievedCredential = await agent.w3cCredentials.getCredentialRecordById(storedCredential.id)
    expect(storedCredential.id).toEqual(retrievedCredential.id)

    expect(repoSpy).toHaveBeenCalledTimes(1)
    expect(repoSpy).toHaveBeenCalledWith(agent.context, storedCredential.id)
    expect(serviceSpy).toHaveBeenCalledTimes(1)
  })

  it('Should successfully remove a credential by id', async () => {
    const repoSpy = vi.spyOn(w3cCredentialRepository, 'deleteById')
    const serviceSpy = vi.spyOn(w3cCredentialService, 'removeCredentialRecord')

    const storedCredential = await agent.w3cCredentials.storeCredential({
      credential: testCredential,
    })

    await agent.w3cCredentials.removeCredentialRecord(storedCredential.id)

    expect(repoSpy).toHaveBeenCalledTimes(1)
    expect(serviceSpy).toHaveBeenCalledTimes(1)
    expect(serviceSpy).toHaveBeenCalledWith(agent.context, storedCredential.id)

    const allCredentials = await agent.w3cCredentials.getAllCredentialRecords()
    expect(allCredentials).toHaveLength(0)
  })
})
