import '@hyperledger/indy-vdr-nodejs'
import type { AnonCredsRevocationRegistryDefinition } from '@credo-ts/anoncreds'
import { AnonCredsRegistryService } from '@credo-ts/anoncreds'

import { getAgentContext } from '../../../../core/tests'
import { IndyVdrModuleConfig } from '../../IndyVdrModuleConfig'
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
        resolutionMetadata: {
          servedFromRecord: true,
        },
      })
      .mockResolvedValueOnce({
        revocationRegistryDefinition,
        revocationRegistryDefinitionId,
        revocationRegistryDefinitionMetadata: {
          issuanceType: 'ISSUANCE_ON_DEMAND',
        },
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
        [IndyVdrPoolService, { getPoolForDid: vi.fn().mockReturnValue({ pool }) }],
        [
          AnonCredsRegistryService,
          {
            getRevocationRegistryDefinition,
          },
        ],
      ],
    })

    const result = await new IndyVdrAnonCredsRegistry().getRevocationStatusList(
      agentContext,
      revocationRegistryDefinitionId,
      1
    )

    // Local record without issuance type defaults to ISSUANCE_BY_DEFAULT
    expect(result.resolutionMetadata).toEqual({})
    expect(result.revocationStatusList?.revocationList).toEqual([0, 0, 0])
    expect(getRevocationRegistryDefinition).toHaveBeenCalledTimes(1)

    // Issuance type from the ledger is used
    const ledgerResult = await new IndyVdrAnonCredsRegistry().getRevocationStatusList(
      agentContext,
      revocationRegistryDefinitionId,
      1
    )

    expect(ledgerResult.resolutionMetadata).toEqual({})
    expect(ledgerResult.revocationStatusList?.revocationList).toEqual([1, 1, 1])

    const missingDefinitionResult = await new IndyVdrAnonCredsRegistry().getRevocationStatusList(
      agentContext,
      revocationRegistryDefinitionId,
      1
    )

    expect(missingDefinitionResult.revocationStatusList).toBeUndefined()
    expect(missingDefinitionResult.resolutionMetadata.message).toBeTruthy()
  })

  describe('percent-encoded did:indy ids', () => {
    const did = 'did:indy:pool:localtest:V4SGRU86Z58d6TV7PBUe6f'

    function getRegistryAgentContext(submitRequest: ReturnType<typeof vi.fn>, encodeAnonCredsIdentifiers?: boolean) {
      return getAgentContext({
        registerInstances: [
          [
            IndyVdrPoolService,
            { getPoolForDid: vi.fn().mockResolvedValue({ pool: { indyNamespace: 'pool:localtest', submitRequest } }) },
          ],
          [
            IndyVdrModuleConfig,
            new IndyVdrModuleConfig({
              indyVdr: {} as never,
              networks: [] as never,
              encodeAnonCredsIdentifiers,
            }),
          ],
        ],
      })
    }

    const schemaTransaction = {
      result: {
        data: {
          txn: {
            type: '101',
            data: { data: { attr_names: ['name'], name: 'Medical Bill', version: '1.0' } },
            metadata: { from: 'V4SGRU86Z58d6TV7PBUe6f' },
          },
        },
      },
    }
    const credentialDefinitionResponse = {
      result: { ref: 10, tag: 'SCH Employee ID', data: { primary: {} } },
    }

    test('returns every form of a did:indy id', () => {
      expect(
        new IndyVdrAnonCredsRegistry().getIdentifierVariants(`${did}/anoncreds/v0/SCHEMA/Medical Bill/1.0`)
      ).toEqual([`${did}/anoncreds/v0/SCHEMA/Medical%20Bill/1.0`, `${did}/anoncreds/v0/SCHEMA/Medical Bill/1.0`])
    })

    test('resolves a schema with a percent-encoded or unencoded id from the same ledger schema', async () => {
      const submitRequest = vi.fn().mockResolvedValue({
        result: { seqNo: 10, data: { attr_names: ['name'], name: 'Medical Bill', version: '1.0' } },
      })
      const agentContext = getRegistryAgentContext(submitRequest)

      for (const schemaId of [
        `${did}/anoncreds/v0/SCHEMA/Medical%20Bill/1.0`,
        `${did}/anoncreds/v0/SCHEMA/Medical Bill/1.0`,
      ]) {
        const result = await new IndyVdrAnonCredsRegistry().getSchema(agentContext, schemaId)
        expect(result.schemaId).toEqual(schemaId)
        expect(result.schema?.name).toEqual('Medical Bill')
      }

      const ledgerSchemaNames = submitRequest.mock.calls.map(
        ([request]) => JSON.parse(request.body).operation.data.name
      )
      expect(ledgerSchemaNames).toEqual(['Medical Bill', 'Medical Bill'])
    })

    test.each([
      [undefined, `${did}/anoncreds/v0/SCHEMA/Medical Bill/1.0`],
      [true, `${did}/anoncreds/v0/SCHEMA/Medical%20Bill/1.0`],
    ])(
      'resolves a credential definition with a percent-encoded id, with encodeAnonCredsIdentifiers %s',
      async (percentEncode, schemaId) => {
        const submitRequest = vi
          .fn()
          .mockResolvedValueOnce(credentialDefinitionResponse)
          .mockResolvedValueOnce(schemaTransaction)
        const agentContext = getRegistryAgentContext(submitRequest, percentEncode)

        const credentialDefinitionId = `${did}/anoncreds/v0/CLAIM_DEF/10/SCH%20Employee%20ID`
        const result = await new IndyVdrAnonCredsRegistry().getCredentialDefinition(
          agentContext,
          credentialDefinitionId
        )

        expect(JSON.parse(submitRequest.mock.calls[0][0].body).operation).toMatchObject({
          ref: 10,
          tag: 'SCH Employee ID',
        })
        expect(result.credentialDefinitionId).toEqual(credentialDefinitionId)
        expect(result.credentialDefinition?.schemaId).toEqual(schemaId)
      }
    )

    test.each([
      [undefined, `${did}/anoncreds/v0/CLAIM_DEF/10/SCH Employee ID`],
      [true, `${did}/anoncreds/v0/CLAIM_DEF/10/SCH%20Employee%20ID`],
    ])(
      'resolves a revocation registry definition with an unencoded id, with encodeAnonCredsIdentifiers %s',
      async (percentEncode, credentialDefinitionId) => {
        const submitRequest = vi.fn().mockResolvedValue({
          result: {
            data: {
              revocDefType: 'CL_ACCUM',
              tag: 'REV 1',
              value: {
                maxCredNum: 3,
                tailsHash: 'hash',
                tailsLocation: 'https://example.com/tails',
                publicKeys: { accumKey: { z: 'z' } },
                issuanceType: 'ISSUANCE_BY_DEFAULT',
              },
            },
          },
        })
        const agentContext = getRegistryAgentContext(submitRequest, percentEncode)

        const result = await new IndyVdrAnonCredsRegistry().getRevocationRegistryDefinition(
          agentContext,
          `${did}/anoncreds/v0/REV_REG_DEF/10/SCH Employee ID/REV 1`
        )

        expect(JSON.parse(submitRequest.mock.calls[0][0].body).operation.id).toEqual(
          'V4SGRU86Z58d6TV7PBUe6f:4:V4SGRU86Z58d6TV7PBUe6f:3:CL:10:SCH Employee ID:CL_ACCUM:REV 1'
        )
        expect(result.revocationRegistryDefinition?.credDefId).toEqual(credentialDefinitionId)
      }
    )
  })
})
