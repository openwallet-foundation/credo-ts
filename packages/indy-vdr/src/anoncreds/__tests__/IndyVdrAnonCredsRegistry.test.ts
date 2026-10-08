import '@hyperledger/indy-vdr-nodejs'
import type { AnonCredsRevocationRegistryDefinition } from '@credo-ts/anoncreds'
import { AnonCredsRegistryService } from '@credo-ts/anoncreds'

import { getAgentContext } from '../../../../core/tests'
import { IndyVdrPoolService } from '../../pool'
import { IndyVdrAnonCredsRegistry } from '../IndyVdrAnonCredsRegistry'

const revocationRegistryDefinitionId =
  'did:indy:pool:localtest:V4SGRU86Z58d6TV7PBUe6f/anoncreds/v0/REV_REG_DEF/1/TAG/REV_TAG'

const revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition = {
  issuerId: 'did:indy:pool:localtest:V4SGRU86Z58d6TV7PBUe6f',
  revocDefType: 'CL_ACCUM',
  credDefId: 'did:indy:pool:localtest:V4SGRU86Z58d6TV7PBUe6f/anoncreds/v0/CLAIM_DEF/1/TAG',
  tag: 'REV_TAG',
  value: {
    publicKeys: {
      accumKey: {
        z: 'accumulator-key',
      },
    },
    maxCredNum: 3,
    tailsLocation: 'https://example.com/tails',
    tailsHash: 'tails-hash',
  },
}

describe('IndyVdrAnonCredsRegistry', () => {
  test('defaults missing issuance metadata of local records, uses ledger metadata and reports missing definitions', async () => {
    const getRevocationRegistryDefinition = vi
      .fn()
      .mockResolvedValueOnce({
        revocationRegistryDefinition,
        revocationRegistryDefinitionId,
        revocationRegistryDefinitionMetadata: {},
        resolutionMetadata: { servedFromRecord: true },
      })
      .mockResolvedValueOnce({
        revocationRegistryDefinition,
        revocationRegistryDefinitionId,
        revocationRegistryDefinitionMetadata: { issuanceType: 'ISSUANCE_ON_DEMAND' },
        resolutionMetadata: {},
      })
      .mockResolvedValueOnce({
        revocationRegistryDefinitionId,
        revocationRegistryDefinitionMetadata: {},
        resolutionMetadata: {},
      })
    const pool = {
      indyNamespace: 'pool:localtest',
      submitRequest: vi.fn().mockResolvedValue({
        result: {
          data: {
            value: {
              accum_to: { value: { accum: 'accumulator' } },
              issued: [],
              revoked: [],
            },
          },
          txnTime: 1,
          type: '117',
        },
      }),
    }
    const agentContext = getAgentContext({
      registerInstances: [
        [IndyVdrPoolService, { getPoolForDid: vi.fn().mockResolvedValue({ pool }) }],
        [AnonCredsRegistryService, { getRevocationRegistryDefinition }],
      ],
    })
    const registry = new IndyVdrAnonCredsRegistry()

    const result = await registry.getRevocationStatusList(agentContext, revocationRegistryDefinitionId, 1)

    // Local records without issuance type default to ISSUANCE_BY_DEFAULT without a second resolution.
    expect(result.resolutionMetadata).toEqual({})
    expect(result.revocationStatusList?.revocationList).toEqual([0, 0, 0])
    expect(getRevocationRegistryDefinition).toHaveBeenCalledTimes(1)

    // Resolved definitions use the issuance type supplied by the registry.
    const ledgerResult = await registry.getRevocationStatusList(agentContext, revocationRegistryDefinitionId, 1)

    expect(ledgerResult.resolutionMetadata).toEqual({})
    expect(ledgerResult.revocationStatusList?.revocationList).toEqual([1, 1, 1])

    const missingDefinitionResult = await registry.getRevocationStatusList(
      agentContext,
      revocationRegistryDefinitionId,
      1
    )

    expect(missingDefinitionResult.revocationStatusList).toBeUndefined()
    expect(missingDefinitionResult.resolutionMetadata.message).toBeTruthy()
  })
})
