import { JsonTransformer } from '@aries-framework/core'
import { Type } from 'class-transformer'
import { IsArray } from 'class-validator'

import { AnonCredsRestriction, AnonCredsRestrictionTransformer } from '../AnonCredsRestriction'

// We need to add the transformer class to the wrapper
class Wrapper {
  public constructor(options: Wrapper) {
    if (options) {
      this.restrictions = options.restrictions
    }
  }

  @Type(() => AnonCredsRestriction)
  @IsArray()
  @AnonCredsRestrictionTransformer()
  public restrictions!: AnonCredsRestriction[]
}

describe('AnonCredsRestriction', () => {
  test('parses attribute values and markers', () => {
    const anonCredsRestrictions = JsonTransformer.fromJSON(
      {
        restrictions: [
          {
            'attr::test_prop::value': 'test_value',
            'attr::test_prop2::value': 'test_value2',
            'attr::test_prop::marker': '1',
            'attr::test_prop2::marker': '1',
          },
        ],
      },
      Wrapper
    )

    expect(anonCredsRestrictions).toEqual({
      restrictions: [
        {
          attributeValues: {
            test_prop: 'test_value',
            test_prop2: 'test_value2',
          },
          attributeMarkers: {
            test_prop: true,
            test_prop2: true,
          },
        },
      ],
    })
  })

  test('transforms attributeValues and attributeMarkers to json', () => {
    const restrictions = new Wrapper({
      restrictions: [
        new AnonCredsRestriction({
          attributeMarkers: {
            test_prop: true,
            test_prop2: true,
          },
          attributeValues: {
            test_prop: 'test_value',
            test_prop2: 'test_value2',
          },
        }),
      ],
    })

    expect(JsonTransformer.toJSON(restrictions)).toMatchObject({
      restrictions: [
        {
          'attr::test_prop::value': 'test_value',
          'attr::test_prop2::value': 'test_value2',
          'attr::test_prop::marker': '1',
          'attr::test_prop2::marker': '1',
        },
      ],
    })
  })

  test('transforms properties from and to json with correct casing', () => {
    const restrictions = new Wrapper({
      restrictions: [
        new AnonCredsRestriction({
          credentialDefinitionId: 'credentialDefinitionId',
          issuerDid: 'issuerDid',
          issuerId: 'issuerId',
          schemaName: 'schemaName',
          schemaVersion: 'schemaVersion',
          schemaId: 'schemaId',
          schemaIssuerDid: 'schemaIssuerDid',
          schemaIssuerId: 'schemaIssuerId',
        }),
      ],
    })

    expect(JsonTransformer.toJSON(restrictions)).toMatchObject({
      restrictions: [
        {
          cred_def_id: 'credentialDefinitionId',
          issuer_did: 'issuerDid',
          issuer_id: 'issuerId',
          schema_name: 'schemaName',
          schema_version: 'schemaVersion',
          schema_id: 'schemaId',
          schema_issuer_did: 'schemaIssuerDid',
          schema_issuer_id: 'schemaIssuerId',
        },
      ],
    })

    expect(
      JsonTransformer.fromJSON(
        {
          restrictions: [
            {
              cred_def_id: 'credentialDefinitionId',
              issuer_did: 'issuerDid',
              issuer_id: 'issuerId',
              schema_name: 'schemaName',
              schema_version: 'schemaVersion',
              schema_id: 'schemaId',
              schema_issuer_did: 'schemaIssuerDid',
              schema_issuer_id: 'schemaIssuerId',
            },
          ],
        },
        Wrapper
      )
    ).toMatchObject({
      restrictions: [
        {
          credentialDefinitionId: 'credentialDefinitionId',
          issuerDid: 'issuerDid',
          issuerId: 'issuerId',
          schemaName: 'schemaName',
          schemaVersion: 'schemaVersion',
          schemaId: 'schemaId',
          schemaIssuerDid: 'schemaIssuerDid',
          schemaIssuerId: 'schemaIssuerId',
        },
      ],
    })
  })
})
