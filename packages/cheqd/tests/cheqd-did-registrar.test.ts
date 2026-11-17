import { CacheModuleConfig, DidDocument, DidRepository, InjectionSymbols, InMemoryLruCache, Kms } from '@credo-ts/core'
import { Subject } from 'rxjs'
import { InMemoryStorageService } from '../../../tests/InMemoryStorageService'
import { agentDependencies, getAgentContext } from '../../core/tests/helpers'
import { CheqdDidRegistrar } from '../src/dids/CheqdDidRegistrar'
import { CheqdLedgerService } from '../src/ledger'
import { validDid } from './testUtils'

function getCheqdAgentContext(cheqdLedgerService: Partial<CheqdLedgerService>) {
  return getAgentContext({
    registerInstances: [
      [InjectionSymbols.Stop$, new Subject<boolean>()],
      [InjectionSymbols.AgentDependencies, agentDependencies],
      [InjectionSymbols.StorageService, new InMemoryStorageService()],
      [CacheModuleConfig, new CacheModuleConfig({ cache: new InMemoryLruCache({ limit: 500 }) })],
      [CheqdLedgerService, cheqdLedgerService],
    ],
  })
}

describe('CheqdDidRegistrar', () => {
  it('finishes deactivating a did that is already deactivated on the ledger', async () => {
    const didDocument = { id: validDid, '@context': ['https://www.w3.org/ns/did/v1'] }
    const agentContext = getCheqdAgentContext({
      resolve: vi.fn().mockResolvedValue({ didDocument, didDocumentMetadata: { deactivated: true } }),
    })
    await agentContext.resolve(DidRepository).storeCreatedDid(agentContext, {
      did: validDid,
      didDocument: new DidDocument({ id: validDid }),
    })

    const result = await new CheqdDidRegistrar().deactivate(agentContext, {
      did: validDid,
      method: 'cheqd',
      options: {},
    })

    expect(result.didState).toMatchObject({ state: 'finished', did: validDid, didDocument: { id: validDid } })
  })

  it('deletes the created key when the ledger rejects the write', async () => {
    const agentContext = getCheqdAgentContext({ create: vi.fn().mockResolvedValue({ code: 1, rawLog: 'rejected' }) })
    const deleteKeySpy = vi.spyOn(agentContext.resolve(Kms.KeyManagementApi), 'deleteKey')

    const result = await new CheqdDidRegistrar().create(agentContext, {
      method: 'cheqd',
      options: { createKey: { type: { kty: 'OKP', crv: 'Ed25519' }, keyId: 'rejected-key' }, network: 'testnet' },
    })

    expect(result.didState).toMatchObject({ state: 'failed', reason: 'unknownError: rejected' })
    expect(deleteKeySpy).toHaveBeenCalledWith(expect.objectContaining({ keyId: 'rejected-key' }))
  })

  it('keeps the created key when the ledger write throws, as it can still reach the ledger', async () => {
    const agentContext = getCheqdAgentContext({ create: vi.fn().mockRejectedValue(new Error('timeout')) })
    const deleteKeySpy = vi.spyOn(agentContext.resolve(Kms.KeyManagementApi), 'deleteKey')

    const result = await new CheqdDidRegistrar().create(agentContext, {
      method: 'cheqd',
      options: { createKey: { type: { kty: 'OKP', crv: 'Ed25519' }, keyId: 'timed-out-key' }, network: 'testnet' },
    })

    expect(result.didState).toMatchObject({ state: 'failed', reason: 'unknownError: timeout' })
    expect(deleteKeySpy).not.toHaveBeenCalled()
    await expect(
      agentContext.resolve(Kms.KeyManagementApi).getPublicKey({ keyId: 'timed-out-key' })
    ).resolves.toBeDefined()
  })

  it('adds the verification method of a key created in the update', async () => {
    const update = vi.fn().mockResolvedValue({ code: 0 })
    const agentContext = getCheqdAgentContext({ create: vi.fn().mockResolvedValue({ code: 0 }), update })
    const registrar = new CheqdDidRegistrar()
    const createResult = await registrar.create(agentContext, {
      method: 'cheqd',
      options: { createKey: { type: { kty: 'OKP', crv: 'Ed25519' } }, network: 'testnet' },
    })
    const didDocument = createResult.didState.didDocument as DidDocument
    agentContext.resolve(CheqdLedgerService).resolve = vi
      .fn()
      .mockResolvedValue({ didDocument: didDocument.toJSON(), didDocumentMetadata: {} })

    const result = await registrar.update(agentContext, {
      did: didDocument.id,
      didDocument,
      options: { createKey: { type: { kty: 'OKP', crv: 'Ed25519' }, keyId: 'update-key' } },
    })

    expect(result.didState.state).toBe('finished')
    const { publicKey } = await agentContext.resolve(Kms.KeyManagementApi).getPublicKey({ keyId: 'update-key' })
    expect(update.mock.calls[0][0].verificationMethod[1].publicKeyJwk).toEqual({
      kty: 'OKP',
      crv: 'Ed25519',
      x: (publicKey as Kms.KmsJwkPublicOkp).x,
    })
  })
})
