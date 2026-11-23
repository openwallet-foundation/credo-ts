import { getAgentOptions } from '../../../../tests'
import { Agent } from '../../../agent/Agent'
import { RecordNotFoundError } from '../../../error'
import { addCredentialHolderBindingKeys } from '../../../utils/credentialHolderBinding'
import { MdocRecord } from '../repository'
import { sprindFunkeTestVectorBase64Url } from './mdoc.fixtures'

describe('mdoc deleteById', () => {
  const agent = new Agent(getAgentOptions('mdoc-delete-test-agent', {}))

  beforeAll(async () => {
    await agent.initialize()
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  test('deletes the device key created for the credential only when asked', async () => {
    const storeWithKey = async (createdForCredential: boolean) => {
      const { keyId, backend } = await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
      const record = new MdocRecord({
        credentialInstances: [
          { issuerSignedBase64Url: sprindFunkeTestVectorBase64Url, kmsKeyId: keyId, kmsBackend: backend },
        ],
      })
      if (createdForCredential) addCredentialHolderBindingKeys(record, [{ keyId, kmsBackend: backend }])
      await agent.mdoc.store({ record })
      return { record, keyId }
    }

    const notCreatedForCredential = await storeWithKey(false)
    await agent.mdoc.deleteById(notCreatedForCredential.record.id, { deleteAssociatedKeys: true })
    await expect(agent.kms.getPublicKey({ keyId: notCreatedForCredential.keyId })).resolves.toBeDefined()

    const kept = await storeWithKey(true)
    await agent.mdoc.deleteById(kept.record.id)
    await expect(agent.mdoc.getById(kept.record.id)).rejects.toThrow(RecordNotFoundError)
    await expect(agent.kms.getPublicKey({ keyId: kept.keyId })).resolves.toBeDefined()

    const deleted = await storeWithKey(true)
    await agent.mdoc.deleteById(deleted.record.id, { deleteAssociatedKeys: true })
    await expect(agent.mdoc.getById(deleted.record.id)).rejects.toThrow(RecordNotFoundError)
    await expect(agent.kms.getPublicKey({ keyId: deleted.keyId })).rejects.toThrow('not found')
  })
})
