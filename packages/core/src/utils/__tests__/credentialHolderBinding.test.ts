import { getAgentOptions } from '../../../tests'
import { Agent } from '../../agent/Agent'
import type { KeyDidCreateOptions } from '../../modules/dids'
import { KeyManagementApi, KeyManagementKeysNotDeletedError } from '../../modules/kms'
import { deleteHolderBindingDids } from '../credentialHolderBinding'

describe('deleteHolderBindingDids', () => {
  const agent = new Agent(getAgentOptions('credential-holder-binding-test-agent', {}))

  beforeAll(async () => {
    await agent.initialize()
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  test('deletes the other dids when the keys of one fail to delete, and keeps that did for a retry', async () => {
    const createDid = async () => {
      const { didState } = await agent.dids.create<KeyDidCreateOptions>({
        method: 'key',
        options: { createKey: { type: { kty: 'OKP', crv: 'Ed25519' } } },
      })
      const [didRecord] = await agent.dids.getCreatedDids({ did: didState.did })
      return { did: didRecord.did, keyId: didRecord.keys?.[0].kmsKeyId as string }
    }
    const failing = await createDid()
    const deleted = await createDid()

    const deleteKey = KeyManagementApi.prototype.deleteKey
    const deleteKeySpy = vi.spyOn(KeyManagementApi.prototype, 'deleteKey').mockImplementation(async function (
      this: KeyManagementApi,
      options
    ) {
      if (options.keyId === failing.keyId) throw new Error('kms unavailable')
      return deleteKey.call(this, options)
    })

    const error = await deleteHolderBindingDids(agent.context, [failing.did, deleted.did]).catch((error) => error)
    expect(error).toBeInstanceOf(KeyManagementKeysNotDeletedError)
    expect(error.keys).toMatchObject([{ keyId: failing.keyId }])
    expect(await agent.dids.getCreatedDids({ did: failing.did })).toHaveLength(1)
    expect(await agent.dids.getCreatedDids({ did: deleted.did })).toHaveLength(0)
    await expect(agent.kms.getPublicKey({ keyId: deleted.keyId })).rejects.toThrow('not found')

    deleteKeySpy.mockRestore()
    await deleteHolderBindingDids(agent.context, [failing.did, deleted.did])
    expect(await agent.dids.getCreatedDids({ did: failing.did })).toHaveLength(0)
    await expect(agent.kms.getPublicKey({ keyId: failing.keyId })).rejects.toThrow('not found')
  })
})
