import { CacheModuleConfig, CredoError, DidRepository, InjectionSymbols, InMemoryLruCache, Kms } from '@credo-ts/core'
import { signWitnessProofEntry, type WitnessProofFileEntry } from 'didwebvh-ts'
import { Subject } from 'rxjs'

import { InMemoryStorageService } from '../../../tests/InMemoryStorageService'
import { agentDependencies, getAgentConfig, getAgentContext } from '../../core/tests/helpers'
import { WebVhApi, WebVhDidRegistrar } from '../src'
import { createWebVhTestKey, createWebVhTestOptions, validDid } from './utils'

vi.mock('didwebvh-ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('didwebvh-ts')>()),
  signWitnessProofEntry: vi.fn(),
}))

describe('WebVhApi controller/witness bridges', () => {
  let context: ReturnType<typeof getAgentContext>
  let api: WebVhApi

  beforeEach(() => {
    vi.mocked(signWitnessProofEntry).mockReset()
    context = getAgentContext({
      agentConfig: getAgentConfig('WebVhApiTest'),
      registerInstances: [
        [InjectionSymbols.Stop$, new Subject<boolean>()],
        [InjectionSymbols.AgentDependencies, agentDependencies],
        [InjectionSymbols.StorageService, new InMemoryStorageService()],
        [CacheModuleConfig, new CacheModuleConfig({ cache: new InMemoryLruCache({ limit: 500 }) })],
      ],
    })
    api = new WebVhApi(context)
  })
  afterEach(() => vi.restoreAllMocks())

  test('returns detached publication data and stores a complete proof file without changing the log or contacting witnesses', async () => {
    const fetch = vi.spyOn(context.config, 'fetch')
    const result = await new WebVhDidRegistrar().create(context, await createWebVhTestOptions(context))
    if (result.didState.state !== 'finished') throw new Error('Fixture create failed')
    const did = result.didState.did
    const before = await api.getPublicationData(did)
    expect(before.witnessProofs).toEqual([])
    const proofs: WitnessProofFileEntry[] = [{ versionId: before.log[0].versionId, proof: [] }]
    await api.storeWitnessProofs(did, proofs)
    proofs[0].versionId = 'mutated'
    const after = await api.getPublicationData(did)
    expect(after.log).toEqual(before.log)
    expect(after.witnessProofs[0].versionId).toBe(before.log[0].versionId)
    after.log[0].versionId = 'mutated'
    expect((await api.getPublicationData(did)).log).toEqual(before.log)
    const replacement: WitnessProofFileEntry[] = [{ versionId: 'replacement', proof: [] }]
    await api.storeWitnessProofs(did, replacement)
    expect((await api.getPublicationData(did)).witnessProofs).toEqual(replacement)
    await api.storeWitnessProofs(did, [])
    expect(await api.getPublicationData(did)).toEqual({ log: before.log, witnessProofs: [] })
    expect(fetch).not.toHaveBeenCalled()
  })

  test('supplies a KMS signer and verifier to upstream witness signing without fetch', async () => {
    const fetch = vi.spyOn(context.config, 'fetch')
    const key = await createWebVhTestKey(context)
    const expected: WitnessProofFileEntry = { versionId: '1-candidate', proof: [] }
    vi.mocked(signWitnessProofEntry).mockResolvedValue(expected)
    const options = { trustedLog: [], candidateLog: [], witnessProofs: [], kmsKeyId: key.keyId }
    expect(await api.signWitnessProof(options)).toBe(expected)
    const input = vi.mocked(signWitnessProofEntry).mock.calls[0][0]
    expect(input).toMatchObject({ trustedLog: [], candidateLog: [], witnessProofs: [], verifier: expect.any(Object) })
    expect(input.witnessSigner.getVerificationMethodId()).toBe(`did:key:${key.multikey}#${key.multikey}`)
    expect(fetch).not.toHaveBeenCalled()
  })

  test('verifies a real log locally and preserves upstream validation failures', async () => {
    const fetch = vi.spyOn(context.config, 'fetch')
    const created = await new WebVhDidRegistrar().create(context, await createWebVhTestOptions(context))
    if (created.didState.state !== 'finished') throw new Error('Fixture create failed')
    const { log } = await api.getPublicationData(created.didState.did)
    expect(await api.verifyWitnessProofs({ log, witnessProofs: [] })).toEqual({
      verified: true,
      requirements: [],
      rejectedProofs: [],
    })
    const corrupted = structuredClone(log)
    corrupted[0].state.id = 'did:webvh:invalid:example.com'
    await expect(api.verifyWitnessProofs({ log: corrupted, witnessProofs: [] })).rejects.toMatchObject({
      name: 'CredoError',
      cause: expect.any(Error),
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  test('fetches published proofs through configured fetch without persisting them', async () => {
    const proofs: WitnessProofFileEntry[] = [{ versionId: '1-example', proof: [] }]
    const fetch = vi
      .spyOn(context.config, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(proofs)))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
    const did = `did:webvh:${validDid.split(':')[2]}:example.com%3A8443:users`
    expect(await api.fetchWitnessProofs(did)).toEqual(proofs)
    expect(fetch).toHaveBeenCalledWith('https://example.com:8443/users/did-witness.json')
    expect(await api.fetchWitnessProofs(did)).toEqual([])
    await expect(api.fetchWitnessProofs(did)).rejects.toMatchObject({ cause: expect.any(Error) })
    expect(await context.resolve(DidRepository).getAll(context)).toEqual([])
  })

  test('resolves a supplied unpublished log and preserves upstream validation errors', async () => {
    const fetch = vi.spyOn(context.config, 'fetch')
    const created = await new WebVhDidRegistrar().create(context, await createWebVhTestOptions(context))
    if (created.didState.state !== 'finished') throw new Error('Fixture create failed')
    const { log } = await api.getPublicationData(created.didState.did)
    const result = await api.resolveDIDFromLog(log, { witnessProofs: [], versionNumber: 1 })
    expect(result.didDocument?.id).toBe(created.didState.did)
    expect(result.didDocumentMetadata.versionId).toBe(log[0].versionId)
    const corrupted = structuredClone(log)
    corrupted[0].state.id = 'did:webvh:invalid:example.com'
    expect((await api.resolveDIDFromLog(corrupted, { witnessProofs: [] })).didResolutionMetadata.error).toBeDefined()
    expect(fetch).not.toHaveBeenCalled()
  })

  test('migration retains upstream eligibility errors without changing stored history', async () => {
    const created = await new WebVhDidRegistrar().create(context, await createWebVhTestOptions(context))
    if (created.didState.state !== 'finished') throw new Error('Fixture create failed')
    const { did, didDocument } = created.didState
    const before = await api.getPublicationData(did)
    const result = await api.migrate({ did, didDocument, options: { address: 'example.com' } })
    expect(result.didState).toMatchObject({
      state: 'failed',
      reason: expect.stringContaining('migrateDID requires a percent-encoded U-label DID'),
    })
    expect(await api.getPublicationData(did)).toEqual(before)
  })

  test('wraps upstream witness-signing failures with the original cause', async () => {
    const key = await createWebVhTestKey(context)
    const cause = new Error('candidate log failed upstream validation')
    vi.mocked(signWitnessProofEntry).mockRejectedValue(cause)
    await expect(
      api.signWitnessProof({ trustedLog: [], candidateLog: [], witnessProofs: [], kmsKeyId: key.keyId })
    ).rejects.toMatchObject({ name: 'CredoError', cause })
  })

  test('wraps typed KMS lookup failures without misclassifying them as log validation', async () => {
    const cause = new Kms.KeyManagementKeyNotFoundError('missing', [])
    vi.spyOn(context.resolve(Kms.KeyManagementApi), 'getPublicKey').mockRejectedValue(cause)
    await expect(
      api.signWitnessProof({ trustedLog: [], candidateLog: [], witnessProofs: [], kmsKeyId: 'missing' })
    ).rejects.toMatchObject({ cause })
    expect(signWitnessProofEntry).not.toHaveBeenCalled()
  })

  test('requires a controlled record for publication and persistence', async () => {
    await expect(api.getPublicationData('did:webvh:absent:example.com')).rejects.toBeInstanceOf(CredoError)
    await expect(api.storeWitnessProofs('did:webvh:absent:example.com', [])).rejects.toBeInstanceOf(CredoError)
    expect(await context.resolve(DidRepository).getAll(context)).toHaveLength(0)
  })
})
