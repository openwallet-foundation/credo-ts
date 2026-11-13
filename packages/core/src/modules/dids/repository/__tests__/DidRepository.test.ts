import { Subject } from 'rxjs'
import { InMemoryStorageService } from '../../../../../../../tests/InMemoryStorageService'
import { agentDependencies, getAgentContext } from '../../../../../tests/helpers'
import { EventEmitter } from '../../../../agent/EventEmitter'
import { RecordDuplicateError } from '../../../../error'
import { PublicJwk } from '../../../kms'
import { DidDocumentRole } from '../../domain/DidDocumentRole'
import { DidRecord } from '../DidRecord'
import { DidRepository } from '../DidRepository'

describe('DidRepository lookups', () => {
  const agentContext = getAgentContext()
  const key = PublicJwk.fromPublicKey({
    kty: 'OKP',
    crv: 'Ed25519',
    publicKey: new Uint8Array(32).fill(1),
  })
  let repository: DidRepository

  beforeEach(() => {
    repository = new DidRepository(
      new InMemoryStorageService<DidRecord>(),
      new EventEmitter(agentDependencies, new Subject())
    )
  })

  const record = (role: DidDocumentRole, did = 'did:example:primary') =>
    new DidRecord({
      did,
      role,
      tags: {
        alternativeDids: ['did:example:alias', did],
        recipientKeyFingerprints: [key.fingerprint],
      },
    })

  test.each([DidDocumentRole.Created, DidDocumentRole.Received])(
    'filters %s recipient-key matches by role without querying the role tag',
    async (role) => {
      const created = record(DidDocumentRole.Created)
      const received = record(DidDocumentRole.Received)
      await repository.save(agentContext, created)
      await repository.save(agentContext, received)
      const query = vi.spyOn(repository, 'findByQuery')
      const find = role === DidDocumentRole.Created ? 'findCreatedDidByRecipientKey' : 'findReceivedDidByRecipientKey'

      expect(await repository[find](agentContext, key)).toMatchObject({
        id: role === DidDocumentRole.Created ? created.id : received.id,
      })
      expect(query).toHaveBeenCalledExactlyOnceWith(agentContext, {
        recipientKeyFingerprints: [key.fingerprint],
      })

      await repository.save(agentContext, record(role, 'did:example:duplicate'))
      await expect(repository[find](agentContext, key)).rejects.toThrow(RecordDuplicateError)
    }
  )

  test.each([DidDocumentRole.Created, DidDocumentRole.Received])(
    'finds %s DIDs by primary and alternative DID, deduplicating overlapping matches',
    async (role) => {
      const expected = record(role)
      await repository.save(agentContext, expected)
      await repository.save(
        agentContext,
        record(role === DidDocumentRole.Created ? DidDocumentRole.Received : DidDocumentRole.Created)
      )
      const find = role === DidDocumentRole.Created ? 'findCreatedDid' : 'findReceivedDid'
      const query = vi.spyOn(repository, 'findByQuery')

      expect(await repository[find](agentContext, expected.did)).toMatchObject({ id: expected.id })
      expect(query.mock.calls).toEqual([
        [agentContext, { did: expected.did }],
        [agentContext, { alternativeDids: [expected.did] }],
      ])
      expect(await repository[find](agentContext, 'did:example:alias')).toMatchObject({ id: expected.id })

      await repository.save(agentContext, record(role, 'did:example:duplicate'))
      await expect(repository[find](agentContext, 'did:example:alias')).rejects.toThrow(RecordDuplicateError)
    }
  )

  test('returns null or empty arrays when no DID matches', async () => {
    expect(await repository.findCreatedDidByRecipientKey(agentContext, key)).toBeNull()
    expect(await repository.findReceivedDidByRecipientKey(agentContext, key)).toBeNull()
    expect(await repository.findCreatedDid(agentContext, 'did:example:missing')).toBeNull()
    expect(await repository.findReceivedDid(agentContext, 'did:example:missing')).toBeNull()
    expect(await repository.findAllByDid(agentContext, 'did:example:missing')).toEqual([])
    expect(await repository.getCreatedDids(agentContext, { did: 'did:example:missing' })).toEqual([])
  })

  test('finds all roles by DID with sequential queries and deduplicates by record id', async () => {
    const created = record(DidDocumentRole.Created)
    const received = record(DidDocumentRole.Received)
    const query = vi
      .spyOn(repository, 'findByQuery')
      .mockImplementationOnce(async () => {
        await Promise.resolve()
        expect(query).toHaveBeenCalledTimes(1)
        return [created, received]
      })
      .mockResolvedValueOnce([created, received])

    expect(await repository.findAllByDid(agentContext, created.did)).toEqual([created, received])
    expect(query.mock.calls).toEqual([
      [agentContext, { did: created.did }],
      [agentContext, { alternativeDids: [created.did] }],
    ])
  })

  test('getCreatedDids preserves role and method filters, with and without a DID', async () => {
    const created = record(DidDocumentRole.Created)
    await repository.save(agentContext, created)
    await repository.save(agentContext, record(DidDocumentRole.Received))
    await repository.save(agentContext, record(DidDocumentRole.Created, 'did:other:primary'))

    const query = vi.spyOn(repository, 'findByQuery')
    expect(await repository.getCreatedDids(agentContext, { method: 'example', did: created.did })).toEqual([
      expect.objectContaining({ id: created.id }),
    ])
    expect(query.mock.calls).toEqual([
      [agentContext, { role: DidDocumentRole.Created, method: 'example', did: created.did }],
      [agentContext, { role: DidDocumentRole.Created, method: 'example', alternativeDids: [created.did] }],
    ])
    expect(await repository.getCreatedDids(agentContext, { method: 'example', did: 'did:example:alias' })).toEqual([
      expect.objectContaining({ id: created.id }),
    ])
    expect(await repository.getCreatedDids(agentContext, { method: 'example' })).toEqual([
      expect.objectContaining({ id: created.id }),
    ])
    expect(await repository.getCreatedDids(agentContext, {})).toHaveLength(2)
  })

  test('propagates storage errors', async () => {
    vi.spyOn(repository, 'findByQuery').mockRejectedValue(new Error('storage unavailable'))
    await expect(repository.findCreatedDid(agentContext, 'did:example:primary')).rejects.toThrow('storage unavailable')
  })
})
