import type { AnonCredsRevocationRegistryDefinition } from '@credo-ts/anoncreds'
import type { RevocationRegistryDelta } from '../transform'

import { anonCredsRevocationStatusListFromIndyVdr, indyVdrCreateLatestRevocationDelta } from '../transform'

const createRevocationRegistryDefinition = (maxCreds: number): AnonCredsRevocationRegistryDefinition => ({
  value: {
    tailsHash: 'hash',
    maxCredNum: maxCreds,
    publicKeys: {
      accumKey: {
        z: 'key',
      },
    },
    tailsLocation: 'nowhere',
  },
  revocDefType: 'CL_ACCUM',
  tag: 'REV_TAG',
  issuerId: 'does:not:matter',
  credDefId: 'does:not:matter',
})

describe('transform', () => {
  const accum = 'does not matter'
  const revocationRegistryDefinitionId = 'does:not:matter'

  describe('indy vdr delta to anoncreds revocation status list', () => {
    test('issued and revoked are filled', () => {
      const delta: RevocationRegistryDelta = {
        accum,
        issued: [0, 1, 2, 3, 4],
        revoked: [5, 6, 7, 8, 9],
        txnTime: 1,
      }

      const revocationRegistryDefinition = createRevocationRegistryDefinition(10)

      const statusList = anonCredsRevocationStatusListFromIndyVdr(
        revocationRegistryDefinitionId,
        revocationRegistryDefinition,
        delta,
        true
      )

      expect(statusList.revocationList).toStrictEqual([0, 0, 0, 0, 0, 1, 1, 1, 1, 1])
    })

    test('issued and revoked are empty (issuance by default)', () => {
      const delta: RevocationRegistryDelta = {
        accum,
        issued: [],
        revoked: [],
        txnTime: 1,
      }

      const revocationRegistryDefinition = createRevocationRegistryDefinition(10)

      const statusList = anonCredsRevocationStatusListFromIndyVdr(
        revocationRegistryDefinitionId,
        revocationRegistryDefinition,
        delta,
        true
      )

      expect(statusList.revocationList).toStrictEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    })

    test('issued and revoked are empty (issuance on demand)', () => {
      const delta: RevocationRegistryDelta = {
        accum,
        issued: [],
        revoked: [],
        txnTime: 1,
      }

      const revocationRegistryDefinition = createRevocationRegistryDefinition(10)

      const statusList = anonCredsRevocationStatusListFromIndyVdr(
        revocationRegistryDefinitionId,
        revocationRegistryDefinition,
        delta,
        false
      )

      expect(statusList.revocationList).toStrictEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1])
    })

    test('issued index is too high', () => {
      const delta: RevocationRegistryDelta = {
        accum,
        issued: [200],
        revoked: [5, 6, 7, 8, 9],
        txnTime: 1,
      }

      const revocationRegistryDefinition = createRevocationRegistryDefinition(10)

      expect(() =>
        anonCredsRevocationStatusListFromIndyVdr(
          revocationRegistryDefinitionId,
          revocationRegistryDefinition,
          delta,
          true
        )
      ).toThrow()
    })
  })

  describe('create latest indy vdr delta from status list and previous delta', () => {
    test('delta and status list are equal', () => {
      const delta: RevocationRegistryDelta = {
        accum,
        issued: [0, 1, 2, 3, 4],
        revoked: [5, 6, 7, 8, 9],
        txnTime: 1,
      }

      const revocationStatusList = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]

      const { revoked, issued } = indyVdrCreateLatestRevocationDelta(accum, revocationStatusList, delta)

      expect(revoked).toStrictEqual([])
      expect(issued).toStrictEqual([])
    })

    test('real world case', () => {
      const revocationStatusList = [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ]

      const delta: RevocationRegistryDelta = {
        revoked: [],
        issued: [
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
          30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56,
          57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83,
          84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99,
        ],
        accum:
          '1 22D10308FEB1A73E5D231FBB231385A75AEFF05AFFC26C76CF6080B6831AC8F8 1 24D6BF977A437AD8BD4501070123CD096F680246D22A00B498FB1A660FAAD062 1 207D22D26EAD5941316BBDE33E19F41FE727507888ED750A2C49863AA2ACDCD1 1 243C032573EADB924D9C28BD21106AA2FB7994C85C80A2DAE89F5C011BCFA70C 2 095E45DDF417D05FB10933FFC63D474548B7FFFF7888802F07FFFFFF7D07A8A8 1 0000000000000000000000000000000000000000000000000000000000000000',
        txnTime: 1706887938,
      }

      const { revoked, issued } = indyVdrCreateLatestRevocationDelta(accum, revocationStatusList, delta)

      expect(issued).toStrictEqual([])
      expect(revoked).toStrictEqual([10])
    })

    test('no previous delta', () => {
      const revocationStatusList = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]

      const { revoked, issued } = indyVdrCreateLatestRevocationDelta(accum, revocationStatusList, undefined)

      expect(issued).toStrictEqual([0, 1, 2, 3, 4])
      expect(revoked).toStrictEqual([5, 6, 7, 8, 9])
    })

    test('status list and previous delta are out of sync', () => {
      const delta: RevocationRegistryDelta = {
        accum,
        issued: [0],
        revoked: [5],
        txnTime: 1,
      }

      const revocationStatusList = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]

      const { revoked, issued } = indyVdrCreateLatestRevocationDelta(accum, revocationStatusList, delta)

      expect(issued).toStrictEqual([])
      expect(revoked).toStrictEqual([6, 7, 8, 9])
    })

    test('previous delta index exceeds length of revocation status list', () => {
      const delta: RevocationRegistryDelta = {
        accum,
        issued: [200],
        revoked: [5],
        txnTime: 1,
      }

      const revocationStatusList = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]

      expect(() => indyVdrCreateLatestRevocationDelta(accum, revocationStatusList, delta)).toThrow()
    })

    test('unrevoking a credential adds its index to issued', () => {
      // Previous delta: index 2 was revoked
      const delta = {
        accum,
        issued: [],
        revoked: [2],
        txnTime: 1,
      }

      // Current status: index 2 is now active (unrevoked), no new revokes
      const revocationStatusList = [0, 0, 0, 0, 0]
      const { issued, revoked } = indyVdrCreateLatestRevocationDelta(accum, revocationStatusList, delta)

      expect(issued).toStrictEqual([2])
      expect(revoked).toStrictEqual([])
    })

    test('only newly unrevoked indexes are included in issued', () => {
      // Previous: index 1 and 3 were revoked
      const delta: RevocationRegistryDelta = {
        accum,
        issued: [],
        revoked: [1, 3],
        txnTime: 1,
      }
      // Now: index 1 is unrevoked (active), 3 is still revoked
      const revocationStatusList = [0, 0, 0, 1, 0]
      const { issued, revoked } = indyVdrCreateLatestRevocationDelta(accum, revocationStatusList, delta)
      expect(issued).toStrictEqual([1])
      expect(revoked).toStrictEqual([])
    })

    test('only newly revoked indexes are included in revoked', () => {
      // Previous: index 1 and 3 were revoked
      const delta: RevocationRegistryDelta = {
        accum,
        issued: [],
        revoked: [1, 3],
        txnTime: 1,
      }
      // Now: index 2 is newly revoked
      const revocationStatusList = [0, 1, 1, 1, 0]
      const { issued, revoked } = indyVdrCreateLatestRevocationDelta(accum, revocationStatusList, delta)
      expect(issued).toStrictEqual([])
      expect(revoked).toStrictEqual([2])
    })

    test('no change results in empty issued and revoked', () => {
      const delta: RevocationRegistryDelta = {
        accum,
        issued: [],
        revoked: [1, 3],
        txnTime: 1,
      }
      const revocationStatusList = [0, 1, 0, 1, 0]
      const { issued, revoked } = indyVdrCreateLatestRevocationDelta(accum, revocationStatusList, delta)
      expect(issued).toStrictEqual([])
      expect(revoked).toStrictEqual([])
    })
  })
})
