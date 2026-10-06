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
  test('re-resolves missing issuance metadata from the ledger and reports missing definitions', async () => {
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

    expect(result.revocationStatusList?.revocationList).toEqual([1, 1, 1])
    expect(getRevocationRegistryDefinition).toHaveBeenLastCalledWith(agentContext, revocationRegistryDefinitionId, {
      useLocalRecord: false,
    })

    const missingDefinitionResult = await registry.getRevocationStatusList(
      agentContext,
      revocationRegistryDefinitionId,
      1
    )

    expect(missingDefinitionResult.revocationStatusList).toBeUndefined()
    expect(missingDefinitionResult.resolutionMetadata.message).toBeTruthy()
  })
})
