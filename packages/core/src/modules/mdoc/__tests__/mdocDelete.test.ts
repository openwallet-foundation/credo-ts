import { getAgentOptions } from '../../../../tests'
import { Agent } from '../../../agent/Agent'
import { RecordNotFoundError } from '../../../error'
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

  test('deletes the device key with the credential only when asked', async () => {
    const store = async () => {
      const { keyId, backend } = await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
      const record = await agent.mdoc.store({
        record: new MdocRecord({
          credentialInstances: [
            { issuerSignedBase64Url: sprindFunkeTestVectorBase64Url, kmsKeyId: keyId, kmsBackend: backend },
          ],
        }),
      })
      return { record, keyId }
    }

    const kept = await store()
    await agent.mdoc.deleteById(kept.record.id)
    await expect(agent.mdoc.getById(kept.record.id)).rejects.toThrow(RecordNotFoundError)
    await expect(agent.kms.getPublicKey({ keyId: kept.keyId })).resolves.toBeDefined()

    const deleted = await store()
    await agent.mdoc.deleteById(deleted.record.id, { deleteAssociatedKeys: true })
    await expect(agent.mdoc.getById(deleted.record.id)).rejects.toThrow(RecordNotFoundError)
    await expect(agent.kms.getPublicKey({ keyId: deleted.keyId })).rejects.toThrow('not found')
  })
})
