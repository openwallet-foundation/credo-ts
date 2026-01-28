import type { MockedClassConstructor } from '../../../../../tests/types'
import { getAgentContext } from '../../../tests/helpers'
import { CredoError } from '../../error'
import { MdocRepository } from '../../modules/mdoc'
import { SdJwtVcRecord, type SdJwtVcRecordInstances, SdJwtVcRepository } from '../../modules/sd-jwt-vc'
import { W3cCredentialRepository, W3cV2CredentialRepository } from '../../modules/vc'
import {
  CredentialMultiInstanceState,
  CredentialMultiInstanceUseMode,
  CredentialMultiInstanceUseUpdateMode,
  canUseInstanceFromCredentialRecord,
  useInstanceFromCredentialRecord,
} from '../credentialUse'

vi.mock('../../modules/sd-jwt-vc/SdJwtVcRepository')
vi.mock('../../modules/mdoc/MdocRepository')
vi.mock('../../modules/vc/repository/W3cCredentialRepository')
vi.mock('../../modules/vc/repository/W3cV2CredentialRepository')

const SdJwtVcRepositoryMock = SdJwtVcRepository as MockedClassConstructor<typeof SdJwtVcRepository>
const MdocRepositoryMock = MdocRepository as MockedClassConstructor<typeof MdocRepository>
const W3cCredentialRepositoryMock = W3cCredentialRepository as MockedClassConstructor<typeof W3cCredentialRepository>
const W3cV2CredentialRepositoryMock = W3cV2CredentialRepository as MockedClassConstructor<
  typeof W3cV2CredentialRepository
>

const sdJwtVcRepository = new SdJwtVcRepositoryMock()
const mdocRepository = new MdocRepositoryMock()
const w3cCredentialRepository = new W3cCredentialRepositoryMock()
const w3cV2CredentialRepository = new W3cV2CredentialRepositoryMock()

sdJwtVcRepository.update = vi.fn().mockResolvedValue(undefined)
mdocRepository.update = vi.fn().mockResolvedValue(undefined)
w3cCredentialRepository.update = vi.fn().mockResolvedValue(undefined)
w3cV2CredentialRepository.update = vi.fn().mockResolvedValue(undefined)

sdJwtVcRepository.updateByIdWithLock = vi.fn().mockImplementation(async (ctx, id, callback) => {
  const record = new SdJwtVcRecord({
    id,
    credentialInstances: [] as unknown as SdJwtVcRecordInstances,
  })
  return callback(record)
})
// biome-ignore lint/suspicious/noExplicitAny: no-explanation
mdocRepository.updateByIdWithLock = vi.fn().mockImplementation(async (ctx, id, callback) => callback({} as any))
w3cCredentialRepository.updateByIdWithLock = vi
  .fn()
  // biome-ignore lint/suspicious/noExplicitAny: no-explanation
  .mockImplementation(async (ctx, id, callback) => callback({} as any))
w3cV2CredentialRepository.updateByIdWithLock = vi
  .fn()
  // biome-ignore lint/suspicious/noExplicitAny: no-explanation
  .mockImplementation(async (ctx, id, callback) => callback({} as any))

const agentContext = getAgentContext({
  registerInstances: [
    [SdJwtVcRepository, sdJwtVcRepository],
    [MdocRepository, mdocRepository],
    [W3cCredentialRepository, w3cCredentialRepository],
    [W3cV2CredentialRepository, w3cV2CredentialRepository],
  ],
})

const sdJwtVcRecord = new SdJwtVcRecord({
  credentialInstances: [
    {
      compactSdJwtVc:
        'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature',
    },
  ],
})

const multiInstanceSdJwtVcRecord = new SdJwtVcRecord({
  credentialInstances: [
    {
      compactSdJwtVc:
        'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature1',
    },
    {
      compactSdJwtVc:
        'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature2',
    },
  ],
})

const multiInstanceSdJwtVcRecordSingleInstance = new SdJwtVcRecord({
  credentialInstances: [
    {
      compactSdJwtVc:
        'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature1',
    },
  ],
})
// Simulate a batch credential with only a single entry left
multiInstanceSdJwtVcRecordSingleInstance.multiInstanceState = CredentialMultiInstanceState.MultiInstanceFirstUsed

describe('credentialUse', () => {
  describe('canUseInstanceFromCredentialRecord', () => {
    test('returns true if CredentialMultiInstanceUseMode is First', () => {
      expect(
        canUseInstanceFromCredentialRecord({
          credentialRecord: sdJwtVcRecord,
          useMode: CredentialMultiInstanceUseMode.First,
        })
      ).toEqual(true)
    })

    test('returns true if CredentialMultiInstanceUseMode is NewOrFirst', () => {
      expect(
        canUseInstanceFromCredentialRecord({
          credentialRecord: sdJwtVcRecord,
          useMode: CredentialMultiInstanceUseMode.NewOrFirst,
        })
      ).toEqual(true)
    })

    test('returns true if CredentialMultiInstanceUseMode is NewIfReceivedInBatch and credential was not received in batch', () => {
      expect(
        canUseInstanceFromCredentialRecord({
          credentialRecord: sdJwtVcRecord,
          useMode: CredentialMultiInstanceUseMode.NewIfReceivedInBatch,
        })
      ).toEqual(true)
    })

    test("returns true if CredentialMultiInstanceUseMode is NewIfReceivedInBatch and credential was received in batch, and there's still a new credential available", () => {
      expect(
        canUseInstanceFromCredentialRecord({
          credentialRecord: multiInstanceSdJwtVcRecord,
          useMode: CredentialMultiInstanceUseMode.NewIfReceivedInBatch,
        })
      ).toEqual(true)
    })

    test("returns false if CredentialMultiInstanceUseMode is NewIfReceivedInBatch and credential was received in batch, and there's no new credential available", () => {
      expect(
        canUseInstanceFromCredentialRecord({
          credentialRecord: multiInstanceSdJwtVcRecordSingleInstance,
          useMode: CredentialMultiInstanceUseMode.NewIfReceivedInBatch,
        })
      ).toEqual(false)
    })

    test("returns true if CredentialMultiInstanceUseMode is New and there's still a new credential available", () => {
      expect(
        canUseInstanceFromCredentialRecord({
          credentialRecord: multiInstanceSdJwtVcRecord,
          useMode: CredentialMultiInstanceUseMode.New,
        })
      ).toEqual(true)
    })

    test("returns false if CredentialMultiInstanceUseMode is New and there's no new credential available", () => {
      expect(
        canUseInstanceFromCredentialRecord({
          credentialRecord: multiInstanceSdJwtVcRecordSingleInstance,
          useMode: CredentialMultiInstanceUseMode.New,
        })
      ).toEqual(false)
    })
  })

  describe('useInstanceFromCredentialRecord', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    describe('SdJwtVcRecord', () => {
      test('uses first instance with First mode', async () => {
        const compactSdJwtVc =
          'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature'
        const record = new SdJwtVcRecord({
          credentialInstances: [
            {
              compactSdJwtVc,
            },
          ],
        })

        expect(record.multiInstanceState).toBe(CredentialMultiInstanceState.SingleInstanceUnused)
        const result = await useInstanceFromCredentialRecord({
          agentContext,
          credentialRecord: record,
          useMode: CredentialMultiInstanceUseMode.First,
        })

        expect(result.isReused).toBe(false)
        expect(result.isLastNewInstance).toBe(true)
        expect(result.credentialInstance).toMatchObject({
          header: expect.any(Object),
          payload: expect.objectContaining({
            vct: 'https://example.com/credential',
            exp: 1736796000,
          }),
          compact: compactSdJwtVc,
        })
        expect(record.credentialInstances).toHaveLength(1)
        expect(record.multiInstanceState).toBe(CredentialMultiInstanceState.SingleInstanceUsed)
        expect(sdJwtVcRepository.update).not.toHaveBeenCalled()
      })

      test('uses and removes new instance with New mode', async () => {
        const firstCompact =
          'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature1'
        const secondCompact =
          'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature2'
        const record = new SdJwtVcRecord({
          credentialInstances: [
            {
              compactSdJwtVc: firstCompact,
            },
            {
              compactSdJwtVc: secondCompact,
              kmsKeyId: 'key-123',
            },
          ],
        })

        const result = await useInstanceFromCredentialRecord({
          agentContext,
          credentialRecord: record,
          useMode: CredentialMultiInstanceUseMode.New,
          updateMode: CredentialMultiInstanceUseUpdateMode.Update,
        })

        expect(result.isReused).toBe(false)
        expect(result.isLastNewInstance).toBe(false)
        expect(result.credentialInstance.kmsKeyId).toBe('key-123')
        expect(result.credentialInstance.compact).toBe(secondCompact)
        expect(record.credentialInstances).toHaveLength(1)
        expect(record.credentialInstances[0].compactSdJwtVc).toBe(firstCompact)
        expect(record.multiInstanceState).toBe(CredentialMultiInstanceState.MultiInstanceFirstUnused)
        expect(sdJwtVcRepository.update).toHaveBeenCalledWith(agentContext, record)
      })

      test('throws error with New mode when only single instance available and state is used', async () => {
        const record = new SdJwtVcRecord({
          credentialInstances: [
            {
              compactSdJwtVc:
                'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature',
            },
          ],
        })
        record.multiInstanceState = CredentialMultiInstanceState.SingleInstanceUsed

        await expect(
          useInstanceFromCredentialRecord({
            agentContext,
            credentialRecord: record,
            useMode: CredentialMultiInstanceUseMode.New,
          })
        ).rejects.toThrow(CredoError)
      })

      test('uses new instance with NewOrFirst mode when available', async () => {
        const firstCompact =
          'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature1'
        const secondCompact =
          'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature2'
        const record = new SdJwtVcRecord({
          credentialInstances: [
            {
              compactSdJwtVc: firstCompact,
            },
            {
              compactSdJwtVc: secondCompact,
            },
          ],
        })

        const result = await useInstanceFromCredentialRecord({
          agentContext,
          credentialRecord: record,
          useMode: CredentialMultiInstanceUseMode.NewOrFirst,
        })

        expect(result.isReused).toBe(false)
        expect(result.credentialInstance.compact).toBe(secondCompact)
        expect(record.credentialInstances).toHaveLength(1)
        expect(record.credentialInstances[0].compactSdJwtVc).toBe(firstCompact)
        expect(record.multiInstanceState).toBe(CredentialMultiInstanceState.MultiInstanceFirstUnused)
      })

      test('uses first instance with NewOrFirst mode when no new available', async () => {
        const compactSdJwtVc =
          'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature'
        const record = new SdJwtVcRecord({
          credentialInstances: [
            {
              compactSdJwtVc,
            },
          ],
        })
        record.multiInstanceState = CredentialMultiInstanceState.SingleInstanceUsed

        const result = await useInstanceFromCredentialRecord({
          agentContext,
          credentialRecord: record,
          useMode: CredentialMultiInstanceUseMode.NewOrFirst,
        })

        expect(result.isReused).toBe(true)
        expect(result.credentialInstance.compact).toBe(compactSdJwtVc)
        expect(record.credentialInstances).toHaveLength(1)
        expect(record.multiInstanceState).toBe(CredentialMultiInstanceState.SingleInstanceUsed)
      })

      test('does not update record when updateMode is None', async () => {
        const record = new SdJwtVcRecord({
          credentialInstances: [
            {
              compactSdJwtVc:
                'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature1',
            },
            {
              compactSdJwtVc:
                'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature2',
            },
          ],
        })

        await useInstanceFromCredentialRecord({
          agentContext,
          credentialRecord: record,
          useMode: CredentialMultiInstanceUseMode.New,
          updateMode: CredentialMultiInstanceUseUpdateMode.None,
        })

        expect(sdJwtVcRepository.update).not.toHaveBeenCalled()
        expect(sdJwtVcRepository.updateByIdWithLock).not.toHaveBeenCalled()
      })

      test('uses first instance with NewIfReceivedInBatch mode for single instance record', async () => {
        const compactSdJwtVc =
          'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature'
        const record = new SdJwtVcRecord({
          credentialInstances: [
            {
              compactSdJwtVc,
            },
          ],
        })
        record.multiInstanceState = CredentialMultiInstanceState.SingleInstanceUsed

        const result = await useInstanceFromCredentialRecord({
          agentContext,
          credentialRecord: record,
          useMode: CredentialMultiInstanceUseMode.NewIfReceivedInBatch,
        })

        expect(result.isReused).toBe(true)
        expect(result.isLastNewInstance).toBe(false)
        expect(result.credentialInstance.compact).toBe(compactSdJwtVc)
        expect(record.credentialInstances).toHaveLength(1)
        expect(record.multiInstanceState).toBe(CredentialMultiInstanceState.SingleInstanceUsed)
        expect(sdJwtVcRepository.update).not.toHaveBeenCalled()
      })

      test('uses new instance with NewIfReceivedInBatch mode for multi instance record', async () => {
        const firstCompact =
          'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature1'
        const secondCompact =
          'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature2'
        const record = new SdJwtVcRecord({
          credentialInstances: [
            {
              compactSdJwtVc: firstCompact,
            },
            {
              compactSdJwtVc: secondCompact,
            },
          ],
        })

        const result = await useInstanceFromCredentialRecord({
          agentContext,
          credentialRecord: record,
          useMode: CredentialMultiInstanceUseMode.NewIfReceivedInBatch,
          updateMode: CredentialMultiInstanceUseUpdateMode.Update,
        })

        expect(result.isReused).toBe(false)
        expect(result.isLastNewInstance).toBe(false)
        expect(result.credentialInstance.compact).toBe(secondCompact)
        expect(record.credentialInstances).toHaveLength(1)
        expect(record.credentialInstances[0].compactSdJwtVc).toBe(firstCompact)
        expect(record.multiInstanceState).toBe(CredentialMultiInstanceState.MultiInstanceFirstUnused)
        expect(sdJwtVcRepository.update).toHaveBeenCalled()
      })

      test('throws error when NewIfReceivedInBatch mode used on multi instance record with one left and state is used', async () => {
        const record = new SdJwtVcRecord({
          credentialInstances: [
            {
              compactSdJwtVc:
                'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature1',
            },
          ],
        })
        record.multiInstanceState = CredentialMultiInstanceState.MultiInstanceFirstUsed

        await expect(
          useInstanceFromCredentialRecord({
            agentContext,
            credentialRecord: record,
            useMode: CredentialMultiInstanceUseMode.NewIfReceivedInBatch,
          })
        ).rejects.toThrow(CredoError)
      })

      test('correctly sets isLastNewInstance to false when multiple new instances remain', async () => {
        const firstCompact =
          'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature1'
        const secondCompact =
          'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature2'
        const thirdCompact =
          'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature3'
        const record = new SdJwtVcRecord({
          credentialInstances: [
            {
              compactSdJwtVc: firstCompact,
            },
            {
              compactSdJwtVc: secondCompact,
            },
            {
              compactSdJwtVc: thirdCompact,
            },
          ],
        })

        const result = await useInstanceFromCredentialRecord({
          agentContext,
          credentialRecord: record,
          useMode: CredentialMultiInstanceUseMode.New,
        })

        expect(result.isReused).toBe(false)
        expect(result.isLastNewInstance).toBe(false)
        expect(result.credentialInstance.compact).toBe(thirdCompact)
        expect(record.credentialInstances).toHaveLength(2)
        expect(record.credentialInstances[0].compactSdJwtVc).toBe(firstCompact)
        expect(record.credentialInstances[1].compactSdJwtVc).toBe(secondCompact)
        expect(record.multiInstanceState).toBe(CredentialMultiInstanceState.MultiInstanceFirstUnused)
      })

      describe('State Management', () => {
        test('updates state from SingleInstanceUnused to SingleInstanceUsed when using first instance', async () => {
          const compactSdJwtVc =
            'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature'
          const record = new SdJwtVcRecord({
            credentialInstances: [
              {
                compactSdJwtVc,
              },
            ],
          })

          // Verify initial state
          expect(record.multiInstanceState).toBe(CredentialMultiInstanceState.SingleInstanceUnused)

          const result = await useInstanceFromCredentialRecord({
            agentContext,
            credentialRecord: record,
            useMode: CredentialMultiInstanceUseMode.First,
            updateMode: CredentialMultiInstanceUseUpdateMode.Update,
          })

          expect(result.isReused).toBe(false)
          expect(result.isLastNewInstance).toBe(true)
          expect(record.multiInstanceState).toBe(CredentialMultiInstanceState.SingleInstanceUsed)
          expect(sdJwtVcRepository.update).toHaveBeenCalledWith(agentContext, record)
        })

        test('updates state from MultiInstanceFirstUnused to MultiInstanceFirstUsed when using first instance', async () => {
          const firstCompact =
            'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature1'
          const secondCompact =
            'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature2'
          const record = new SdJwtVcRecord({
            credentialInstances: [
              {
                compactSdJwtVc: firstCompact,
              },
              {
                compactSdJwtVc: secondCompact,
              },
            ],
          })

          // Pop the second one to simulate it being used
          record.credentialInstances.pop()

          // Verify initial state
          expect(record.multiInstanceState).toBe(CredentialMultiInstanceState.MultiInstanceFirstUnused)

          const result = await useInstanceFromCredentialRecord({
            agentContext,
            credentialRecord: record,
            useMode: CredentialMultiInstanceUseMode.First,
            updateMode: CredentialMultiInstanceUseUpdateMode.Update,
          })

          expect(result.isReused).toBe(false)
          expect(result.isLastNewInstance).toBe(true)
          expect(record.multiInstanceState).toBe(CredentialMultiInstanceState.MultiInstanceFirstUsed)
          expect(sdJwtVcRepository.update).toHaveBeenCalledWith(agentContext, record)
        })

        test('does not change state when reusing already used instance', async () => {
          const compactSdJwtVc =
            'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature'
          const record = new SdJwtVcRecord({
            credentialInstances: [
              {
                compactSdJwtVc,
              },
            ],
          })

          // Use it once to mark as used
          record.multiInstanceState = CredentialMultiInstanceState.SingleInstanceUsed

          const result = await useInstanceFromCredentialRecord({
            agentContext,
            credentialRecord: record,
            useMode: CredentialMultiInstanceUseMode.First,
            updateMode: CredentialMultiInstanceUseUpdateMode.Update,
          })

          expect(result.isReused).toBe(true)
          expect(result.isLastNewInstance).toBe(false)
          expect(record.multiInstanceState).toBe(CredentialMultiInstanceState.SingleInstanceUsed)
          expect(sdJwtVcRepository.update).not.toHaveBeenCalled()
        })
      })

      describe('Update Modes', () => {
        test('updates record with Update mode when new instance is used', async () => {
          const firstCompact =
            'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature1'
          const secondCompact =
            'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature2'
          const record = new SdJwtVcRecord({
            credentialInstances: [
              {
                compactSdJwtVc: firstCompact,
              },
              {
                compactSdJwtVc: secondCompact,
              },
            ],
          })

          await useInstanceFromCredentialRecord({
            agentContext,
            credentialRecord: record,
            useMode: CredentialMultiInstanceUseMode.New,
            updateMode: CredentialMultiInstanceUseUpdateMode.Update,
          })

          expect(sdJwtVcRepository.update).toHaveBeenCalledWith(agentContext, record)
          expect(sdJwtVcRepository.updateByIdWithLock).not.toHaveBeenCalled()
        })

        test('does not update record with Update mode when first instance is used and was already used', async () => {
          const compactSdJwtVc =
            'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature'
          const record = new SdJwtVcRecord({
            credentialInstances: [
              {
                compactSdJwtVc,
              },
            ],
          })
          record.multiInstanceState = CredentialMultiInstanceState.SingleInstanceUsed

          await useInstanceFromCredentialRecord({
            agentContext,
            credentialRecord: record,
            useMode: CredentialMultiInstanceUseMode.First,
            updateMode: CredentialMultiInstanceUseUpdateMode.Update,
          })

          expect(sdJwtVcRepository.update).not.toHaveBeenCalled()
          expect(sdJwtVcRepository.updateByIdWithLock).not.toHaveBeenCalled()
        })

        test('refetches and updates record with RefetchAndUpdateWithLock mode', async () => {
          const firstCompact =
            'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature1'
          const secondCompact =
            'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature2'
          const thirdCompact =
            'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature3'

          // Mock updateByIdWithLock to return a fresh record with all instances
          vi.mocked(sdJwtVcRepository.updateByIdWithLock).mockImplementationOnce(async (ctx, id, callback) => {
            const freshRecord = new SdJwtVcRecord({
              id,
              credentialInstances: [
                { compactSdJwtVc: firstCompact },
                { compactSdJwtVc: secondCompact },
                { compactSdJwtVc: thirdCompact },
              ],
            })
            return callback(freshRecord)
          })

          const record = new SdJwtVcRecord({
            id: 'test-id',
            credentialInstances: [
              {
                compactSdJwtVc: firstCompact,
              },
              {
                compactSdJwtVc: secondCompact,
              },
            ],
          })

          const result = await useInstanceFromCredentialRecord({
            agentContext,
            credentialRecord: record,
            useMode: CredentialMultiInstanceUseMode.New,
            updateMode: CredentialMultiInstanceUseUpdateMode.RefetchAndUpdateWithLock,
          })

          // Should use the fresh record's last instance (third compact)
          expect(result.credentialInstance.compact).toBe(thirdCompact)
          expect(sdJwtVcRepository.updateByIdWithLock).toHaveBeenCalledWith(
            agentContext,
            'test-id',
            expect.any(Function)
          )
          expect(sdJwtVcRepository.update).not.toHaveBeenCalled()
        })

        test('does not refetch with RefetchAndUpdateWithLock mode when first instance is used', async () => {
          const compactSdJwtVc =
            'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature'
          const record = new SdJwtVcRecord({
            credentialInstances: [
              {
                compactSdJwtVc,
              },
            ],
          })
          record.multiInstanceState = CredentialMultiInstanceState.SingleInstanceUsed

          await useInstanceFromCredentialRecord({
            agentContext,
            credentialRecord: record,
            useMode: CredentialMultiInstanceUseMode.First,
            updateMode: CredentialMultiInstanceUseUpdateMode.RefetchAndUpdateWithLock,
          })

          expect(sdJwtVcRepository.updateByIdWithLock).not.toHaveBeenCalled()
          expect(sdJwtVcRepository.update).not.toHaveBeenCalled()
        })

        test('handles race condition with RefetchAndUpdateWithLock using NewOrFirst mode', async () => {
          const firstCompact =
            'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature1'
          const secondCompact =
            'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature2'

          // Mock updateByIdWithLock to return a fresh record with only first instance (second was used by another process)
          vi.mocked(sdJwtVcRepository.updateByIdWithLock).mockImplementationOnce(async (ctx, id, callback) => {
            const freshRecord = new SdJwtVcRecord({
              id,
              credentialInstances: [{ compactSdJwtVc: firstCompact }],
            })
            return callback(freshRecord)
          })

          const record = new SdJwtVcRecord({
            id: 'test-id',
            credentialInstances: [
              {
                compactSdJwtVc: firstCompact,
              },
              {
                compactSdJwtVc: secondCompact,
              },
            ],
          })

          const result = await useInstanceFromCredentialRecord({
            agentContext,
            credentialRecord: record,
            useMode: CredentialMultiInstanceUseMode.NewOrFirst,
            updateMode: CredentialMultiInstanceUseUpdateMode.RefetchAndUpdateWithLock,
          })

          // Should use the first instance since no new instance is available in fresh record
          expect(result.credentialInstance.compact).toBe(firstCompact)
          expect(result.isReused).toBe(false)
          expect(result.isLastNewInstance).toBe(true)
        })

        test('throws error with RefetchAndUpdateWithLock and New mode when instance was already used', async () => {
          const firstCompact =
            'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ2Y3QiOiJodHRwczovL2V4YW1wbGUuY29tL2NyZWRlbnRpYWwiLCJleHAiOjE3MzY3OTYwMDB9.signature2'

          // Mock updateByIdWithLock to return a fresh record with only first instance (second was used by another process)
          vi.mocked(sdJwtVcRepository.updateByIdWithLock).mockImplementationOnce(async (ctx, id, callback) => {
            const freshRecord = new SdJwtVcRecord({
              id,
              credentialInstances: [{ compactSdJwtVc: firstCompact }],
            })
            freshRecord.multiInstanceState = CredentialMultiInstanceState.SingleInstanceUsed
            return callback(freshRecord)
          })

          const record = new SdJwtVcRecord({
            id: 'test-id',
            credentialInstances: [
              {
                compactSdJwtVc: firstCompact,
              },
            ],
          })

          await expect(
            useInstanceFromCredentialRecord({
              agentContext,
              credentialRecord: record,
              useMode: CredentialMultiInstanceUseMode.New,
              updateMode: CredentialMultiInstanceUseUpdateMode.RefetchAndUpdateWithLock,
            })
          ).rejects.toThrow(CredoError)
        })
      })
    })
  })
})
