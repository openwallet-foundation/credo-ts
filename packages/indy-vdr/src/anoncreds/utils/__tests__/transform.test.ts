import type { RevocationRegistryDelta } from '../transform'
import type { AnonCredsRevocationRegistryDefinition } from '@aries-framework/anoncreds'

import { indyVdrCreateLatestRevocationDelta, anonCredsRevocationStatusListFromIndyVdr } from '../transform'

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
      ).toThrowError()
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

    test('no previous delta', () => {
      const revocationStatusList = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]

      const { revoked, issued } = indyVdrCreateLatestRevocationDelta(accum, revocationStatusList)

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

      expect(issued).toStrictEqual([1, 2, 3, 4])
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

      expect(() => indyVdrCreateLatestRevocationDelta(accum, revocationStatusList, delta)).toThrowError()
    })
  })
})
