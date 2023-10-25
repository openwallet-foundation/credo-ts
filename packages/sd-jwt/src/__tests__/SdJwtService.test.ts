import type { Key, Logger } from '@aries-framework/core'

import { AskarModule } from '@aries-framework/askar'
import { Hasher, getJwkFromKey, utils, KeyType, Agent, TypedArrayEncoder } from '@aries-framework/core'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import { SdJwtVc } from 'jwt-sd'

import { agentDependencies } from '../../../core/tests'
import { SdJwtService } from '../SdJwtService'

const agent = new Agent({
  config: { label: 'sdjwtserviceagent', walletConfig: { id: utils.uuid(), key: utils.uuid() } },
  modules: { askar: new AskarModule({ ariesAskar }) },
  dependencies: agentDependencies,
})

const logger = jest.fn() as unknown as Logger
agent.context.wallet.generateNonce = jest.fn(() => Promise.resolve('salt'))
Date.prototype.getTime = jest.fn(() => 1698151532000)

describe('SdJwtService', () => {
  let issuerKey: Key
  let holderKey: Key
  let sdJwtService: SdJwtService

  beforeAll(async () => {
    await agent.initialize()

    issuerKey = await agent.context.wallet.createKey({
      keyType: KeyType.Ed25519,
      seed: TypedArrayEncoder.fromString('testseed000000000000000000000001'),
    })

    holderKey = await agent.context.wallet.createKey({
      keyType: KeyType.Ed25519,
      seed: TypedArrayEncoder.fromString('testseed000000000000000000000002'),
    })

    sdJwtService = new SdJwtService(logger)
  })

  describe('SdJwtService.create', () => {
    test('Create sd-jwt-vc from a basic payload without disclosures', async () => {
      const { compact, sdJwtRecord } = await sdJwtService.create(
        agent.context,
        {
          claim: 'some-claim',
          type: 'IdentityCredential',
        },
        {
          issuerKey,
          holderBinding: holderKey,
          issuerDid: 'did:key:123',
        }
      )

      expect(compact).toStrictEqual(
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJjbGFpbSI6InNvbWUtY2xhaW0iLCJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6IlVXM3ZWRWp3UmYwSWt0Sm9jdktSbUdIekhmV0FMdF9YMkswd3ZsdVpJU3MifX0sImlzcyI6ImRpZDprZXk6MTIzIiwiaWF0IjoxNjk4MTUxNTMyfQ.pHv5oFJ6NGadsoY4iwVCuNt6DI-vxCLsvPJulr8KSpMM5ga39fLdCKPJ-DWCdGmbCnsuIJb04Z6SyH8bp-bbAw'
      )

      expect(sdJwtRecord.sdJwt.header).toMatchObject({
        alg: 'EdDSA',
        typ: 'vc+sd-jwt',
      })

      expect(sdJwtRecord.sdJwt.payload).toMatchObject({
        claim: 'some-claim',
        type: 'IdentityCredential',
        iat: Math.floor(new Date().getTime() / 1000),
        cnf: {
          jwk: getJwkFromKey(holderKey).toJson(),
        },
      })
    })

    test('Create sd-jwt-vc from a basic payload with a disclosure', async () => {
      const { compact, sdJwtRecord } = await sdJwtService.create(
        agent.context,
        { claim: 'some-claim', type: 'IdentityCredential' },
        {
          issuerKey,
          holderBinding: holderKey,
          issuerDid: 'did:key:123',
          disclosureFrame: { claim: true },
        }
      )

      expect(compact).toStrictEqual(
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6IlVXM3ZWRWp3UmYwSWt0Sm9jdktSbUdIekhmV0FMdF9YMkswd3ZsdVpJU3MifX0sImlzcyI6ImRpZDprZXk6MTIzIiwiaWF0IjoxNjk4MTUxNTMyLCJfc2RfYWxnIjoic2hhLTI1NiIsIl9zZCI6WyJ2Y3ZGVTREc0ZLVHFRMXZsNG5lbEpXWFRiXy0wZE5vQmtzNmlxTkZwdHlnIl19.IW6PaMTtxMNvqwrRac5nh7L9_ie4r-PUDL6Gqoey2O3axTm6RBrUv0ETLbdgALK6tU_HoIDuNE66DVrISQXaCw~WyJzYWx0IiwiY2xhaW0iLCJzb21lLWNsYWltIl0~'
      )

      expect(sdJwtRecord.sdJwt.header).toMatchObject({
        alg: 'EdDSA',
        typ: 'vc+sd-jwt',
      })

      expect(sdJwtRecord.sdJwt.payload).toMatchObject({
        type: 'IdentityCredential',
        iat: Math.floor(new Date().getTime() / 1000),
        cnf: {
          jwk: getJwkFromKey(holderKey).toJson(),
        },
      })

      expect(sdJwtRecord.sdJwt.payload).not.toContain({
        claim: 'some-claim',
      })

      expect(sdJwtRecord.sdJwt.disclosures).toEqual(expect.arrayContaining([['salt', 'claim', 'some-claim']]))
    })

    test('Create sd-jwt-vc from a basic payload with multiple (nested) disclosure', async () => {
      const { compact, sdJwtRecord } = await sdJwtService.create(
        agent.context,
        {
          type: 'IdentityCredential',
          given_name: 'John',
          family_name: 'Doe',
          email: 'johndoe@example.com',
          phone_number: '+1-202-555-0101',
          address: {
            street_address: '123 Main St',
            locality: 'Anytown',
            region: 'Anystate',
            country: 'US',
          },
          birthdate: '1940-01-01',
          is_over_18: true,
          is_over_21: true,
          is_over_65: true,
        },
        {
          issuerKey,
          holderBinding: holderKey,
          issuerDid: 'did:key:123',
          disclosureFrame: {
            is_over_65: true,
            is_over_21: true,
            is_over_18: true,
            birthdate: true,
            email: true,
            address: { region: true, country: true },
            given_name: true,
          },
        }
      )

      expect(compact).toStrictEqual(
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiZmFtaWx5X25hbWUiOiJEb2UiLCJwaG9uZV9udW1iZXIiOiIrMS0yMDItNTU1LTAxMDEiLCJhZGRyZXNzIjp7InN0cmVldF9hZGRyZXNzIjoiMTIzIE1haW4gU3QiLCJsb2NhbGl0eSI6IkFueXRvd24iLCJfc2QiOlsiTkpubWN0MEJxQk1FMUpmQmxDNmpSUVZSdWV2cEVPTmlZdzdBN01IdUp5USIsIm9tNVp6dFpIQi1HZDAwTEcyMUNWX3hNNEZhRU5Tb2lhT1huVEFKTmN6QjQiXX0sImNuZiI6eyJqd2siOnsia3R5IjoiT0tQIiwiY3J2IjoiRWQyNTUxOSIsIngiOiJVVzN2VkVqd1JmMElrdEpvY3ZLUm1HSHpIZldBTHRfWDJLMHd2bHVaSVNzIn19LCJpc3MiOiJkaWQ6a2V5OjEyMyIsImlhdCI6MTY5ODE1MTUzMiwiX3NkX2FsZyI6InNoYS0yNTYiLCJfc2QiOlsiMUN1cjJrMkEyb0lCNUNzaFNJZl9BX0tnLWwyNnVfcUt1V1E3OVAwVmRhcyIsIlIxelRVdk9ZSGdjZXBqMGpIeXBHSHo5RUh0dFZLZnQweXN3YmM5RVRQYlUiLCJlRHFRcGRUWEpYYldoZi1Fc0k3enc1WDZPdlltRk4tVVpRUU1lc1h3S1B3IiwicGREazJfWEFLSG83Z09BZndGMWI3T2RDVVZUaXQya0pIYXhTRUNROXhmYyIsInBzYXVLVU5XRWkwOW51M0NsODl4S1hnbXBXRU5abDV1eTFOMW55bl9qTWsiLCJzTl9nZTBwSFhGNnFtc1luWDFBOVNkd0o4Y2g4YUVOa3hiT0RzVDc0WXdJIl19.oKI-t9M9ie5_1gV7GkvxwEh6DVIK0ysXdzFtNJT-FwLxkm7FT5D3RkJSug2NSmnxeiYLb1Qc933Toiw6KgPqAA~WyJzYWx0IiwiaXNfb3Zlcl82NSIsdHJ1ZV0~WyJzYWx0IiwiaXNfb3Zlcl8yMSIsdHJ1ZV0~WyJzYWx0IiwiaXNfb3Zlcl8xOCIsdHJ1ZV0~WyJzYWx0IiwiYmlydGhkYXRlIiwiMTk0MC0wMS0wMSJd~WyJzYWx0IiwiZW1haWwiLCJqb2huZG9lQGV4YW1wbGUuY29tIl0~WyJzYWx0IiwicmVnaW9uIiwiQW55c3RhdGUiXQ~WyJzYWx0IiwiY291bnRyeSIsIlVTIl0~WyJzYWx0IiwiZ2l2ZW5fbmFtZSIsIkpvaG4iXQ~'
      )

      expect(sdJwtRecord.sdJwt.header).toMatchObject({
        alg: 'EdDSA',
        typ: 'vc+sd-jwt',
      })

      expect(sdJwtRecord.sdJwt.payload).toMatchObject({
        type: 'IdentityCredential',
        iat: Math.floor(new Date().getTime() / 1000),
        cnf: {
          jwk: getJwkFromKey(holderKey).toJson(),
        },
        address: {
          locality: 'Anytown',
          street_address: '123 Main St',
        },
        phone_number: '+1-202-555-0101',
      })

      expect(sdJwtRecord.sdJwt.payload).not.toContain({
        family_name: 'Doe',
        phone_number: '+1-202-555-0101',
        address: {
          region: 'Anystate',
          country: 'US',
        },
        birthdate: '1940-01-01',
        is_over_18: true,
        is_over_21: true,
        is_over_65: true,
      })

      expect(sdJwtRecord.sdJwt.disclosures).toEqual(
        expect.arrayContaining([
          ['salt', 'is_over_65', true],
          ['salt', 'is_over_21', true],
          ['salt', 'is_over_18', true],
          ['salt', 'birthdate', '1940-01-01'],
          ['salt', 'email', 'johndoe@example.com'],
          ['salt', 'region', 'Anystate'],
          ['salt', 'country', 'US'],
          ['salt', 'given_name', 'John'],
        ])
      )
    })
  })

  describe('SdJwtService.receive', () => {
    test('Receive sd-jwt-vc from a basic payload without disclosures', async () => {
      const sdJwt =
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJjbGFpbSI6InNvbWUtY2xhaW0iLCJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6IlVXM3ZWRWp3UmYwSWt0Sm9jdktSbUdIekhmV0FMdF9YMkswd3ZsdVpJU3MifX0sImlzcyI6ImRpZDprZXk6MTIzIiwiaWF0IjoxNjk4MTUxNTMyfQ.pHv5oFJ6NGadsoY4iwVCuNt6DI-vxCLsvPJulr8KSpMM5ga39fLdCKPJ-DWCdGmbCnsuIJb04Z6SyH8bp-bbAw'

      const sdJwtRecord = await sdJwtService.receive(agent.context, sdJwt, { issuerKey, holderKey })

      expect(sdJwtRecord.sdJwt.header).toMatchObject({
        alg: 'EdDSA',
        typ: 'vc+sd-jwt',
      })

      expect(sdJwtRecord.sdJwt.payload).toMatchObject({
        claim: 'some-claim',
        type: 'IdentityCredential',
        iat: Math.floor(new Date().getTime() / 1000),
        cnf: {
          jwk: getJwkFromKey(holderKey).toJson(),
        },
      })
    })

    test('Receive sd-jwt-vc from a basic payload with a disclosure', async () => {
      const sdJwt =
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6IlVXM3ZWRWp3UmYwSWt0Sm9jdktSbUdIekhmV0FMdF9YMkswd3ZsdVpJU3MifX0sImlzcyI6ImRpZDprZXk6MTIzIiwiaWF0IjoxNjk4MTUxNTMyLCJfc2RfYWxnIjoic2hhLTI1NiIsIl9zZCI6WyJ2Y3ZGVTREc0ZLVHFRMXZsNG5lbEpXWFRiXy0wZE5vQmtzNmlxTkZwdHlnIl19.IW6PaMTtxMNvqwrRac5nh7L9_ie4r-PUDL6Gqoey2O3axTm6RBrUv0ETLbdgALK6tU_HoIDuNE66DVrISQXaCw~WyJzYWx0IiwiY2xhaW0iLCJzb21lLWNsYWltIl0~'

      const sdJwtRecord = await sdJwtService.receive(agent.context, sdJwt, { issuerKey, holderKey })

      expect(sdJwtRecord.sdJwt.header).toMatchObject({
        alg: 'EdDSA',
        typ: 'vc+sd-jwt',
      })

      expect(sdJwtRecord.sdJwt.payload).toMatchObject({
        type: 'IdentityCredential',
        iat: Math.floor(new Date().getTime() / 1000),
        cnf: {
          jwk: getJwkFromKey(holderKey).toJson(),
        },
      })

      expect(sdJwtRecord.sdJwt.payload).not.toContain({
        claim: 'some-claim',
      })

      expect(sdJwtRecord.sdJwt.disclosures).toEqual(expect.arrayContaining([['salt', 'claim', 'some-claim']]))
    })

    test('Receive sd-jwt-vc from a basic payload with multiple (nested) disclosure', async () => {
      const sdJwt =
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiZmFtaWx5X25hbWUiOiJEb2UiLCJwaG9uZV9udW1iZXIiOiIrMS0yMDItNTU1LTAxMDEiLCJhZGRyZXNzIjp7InN0cmVldF9hZGRyZXNzIjoiMTIzIE1haW4gU3QiLCJsb2NhbGl0eSI6IkFueXRvd24iLCJfc2QiOlsiTkpubWN0MEJxQk1FMUpmQmxDNmpSUVZSdWV2cEVPTmlZdzdBN01IdUp5USIsIm9tNVp6dFpIQi1HZDAwTEcyMUNWX3hNNEZhRU5Tb2lhT1huVEFKTmN6QjQiXX0sImNuZiI6eyJqd2siOnsia3R5IjoiT0tQIiwiY3J2IjoiRWQyNTUxOSIsIngiOiJVVzN2VkVqd1JmMElrdEpvY3ZLUm1HSHpIZldBTHRfWDJLMHd2bHVaSVNzIn19LCJpc3MiOiJkaWQ6a2V5OjEyMyIsImlhdCI6MTY5ODE1MTUzMiwiX3NkX2FsZyI6InNoYS0yNTYiLCJfc2QiOlsiMUN1cjJrMkEyb0lCNUNzaFNJZl9BX0tnLWwyNnVfcUt1V1E3OVAwVmRhcyIsIlIxelRVdk9ZSGdjZXBqMGpIeXBHSHo5RUh0dFZLZnQweXN3YmM5RVRQYlUiLCJlRHFRcGRUWEpYYldoZi1Fc0k3enc1WDZPdlltRk4tVVpRUU1lc1h3S1B3IiwicGREazJfWEFLSG83Z09BZndGMWI3T2RDVVZUaXQya0pIYXhTRUNROXhmYyIsInBzYXVLVU5XRWkwOW51M0NsODl4S1hnbXBXRU5abDV1eTFOMW55bl9qTWsiLCJzTl9nZTBwSFhGNnFtc1luWDFBOVNkd0o4Y2g4YUVOa3hiT0RzVDc0WXdJIl19.oKI-t9M9ie5_1gV7GkvxwEh6DVIK0ysXdzFtNJT-FwLxkm7FT5D3RkJSug2NSmnxeiYLb1Qc933Toiw6KgPqAA~WyJzYWx0IiwiaXNfb3Zlcl82NSIsdHJ1ZV0~WyJzYWx0IiwiaXNfb3Zlcl8yMSIsdHJ1ZV0~WyJzYWx0IiwiaXNfb3Zlcl8xOCIsdHJ1ZV0~WyJzYWx0IiwiYmlydGhkYXRlIiwiMTk0MC0wMS0wMSJd~WyJzYWx0IiwiZW1haWwiLCJqb2huZG9lQGV4YW1wbGUuY29tIl0~WyJzYWx0IiwicmVnaW9uIiwiQW55c3RhdGUiXQ~WyJzYWx0IiwiY291bnRyeSIsIlVTIl0~WyJzYWx0IiwiZ2l2ZW5fbmFtZSIsIkpvaG4iXQ~'

      const sdJwtRecord = await sdJwtService.receive(agent.context, sdJwt, { holderKey, issuerKey })

      expect(sdJwtRecord.sdJwt.header).toMatchObject({
        alg: 'EdDSA',
        typ: 'vc+sd-jwt',
      })

      expect(sdJwtRecord.sdJwt.payload).toMatchObject({
        type: 'IdentityCredential',
        iat: Math.floor(new Date().getTime() / 1000),
        cnf: {
          jwk: getJwkFromKey(holderKey).toJson(),
        },
        address: {
          locality: 'Anytown',
          street_address: '123 Main St',
        },
        phone_number: '+1-202-555-0101',
      })

      expect(sdJwtRecord.sdJwt.payload).not.toContain({
        family_name: 'Doe',
        phone_number: '+1-202-555-0101',
        address: {
          region: 'Anystate',
          country: 'US',
        },
        birthdate: '1940-01-01',
        is_over_18: true,
        is_over_21: true,
        is_over_65: true,
      })

      expect(sdJwtRecord.sdJwt.disclosures).toEqual(
        expect.arrayContaining([
          ['salt', 'is_over_65', true],
          ['salt', 'is_over_21', true],
          ['salt', 'is_over_18', true],
          ['salt', 'birthdate', '1940-01-01'],
          ['salt', 'email', 'johndoe@example.com'],
          ['salt', 'region', 'Anystate'],
          ['salt', 'country', 'US'],
          ['salt', 'given_name', 'John'],
        ])
      )
    })
  })

  describe('SdJwtService.present', () => {
    test('Present sd-jwt-vc from a basic payload without disclosures', async () => {
      const sdJwt =
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJjbGFpbSI6InNvbWUtY2xhaW0iLCJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6IlVXM3ZWRWp3UmYwSWt0Sm9jdktSbUdIekhmV0FMdF9YMkswd3ZsdVpJU3MifX0sImlzcyI6ImRpZDprZXk6MTIzIiwiaWF0IjoxNjk4MTUxNTMyfQ.pHv5oFJ6NGadsoY4iwVCuNt6DI-vxCLsvPJulr8KSpMM5ga39fLdCKPJ-DWCdGmbCnsuIJb04Z6SyH8bp-bbAw'

      const sdJwtRecord = await sdJwtService.receive(agent.context, sdJwt, { issuerKey, holderKey })

      const presentation = await sdJwtService.present(agent.context, sdJwtRecord, {
        holderKey,
        verifierMetadata: {
          issuedAt: new Date().getTime() / 1000,
          audienceDid: 'did:key:audience',
          nonce: await agent.context.wallet.generateNonce(),
        },
      })

      expect(presentation).toStrictEqual(
        `eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJjbGFpbSI6InNvbWUtY2xhaW0iLCJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6IlVXM3ZWRWp3UmYwSWt0Sm9jdktSbUdIekhmV0FMdF9YMkswd3ZsdVpJU3MifX0sImlzcyI6ImRpZDprZXk6MTIzIiwiaWF0IjoxNjk4MTUxNTMyfQ.pHv5oFJ6NGadsoY4iwVCuNt6DI-vxCLsvPJulr8KSpMM5ga39fLdCKPJ-DWCdGmbCnsuIJb04Z6SyH8bp-bbAw~eyJhbGciOiJFZERTQSIsInR5cCI6ImtiK2p3dCJ9.eyJpYXQiOjE2OTgxNTE1MzIsIm5vbmNlIjoic2FsdCIsImF1ZCI6ImRpZDprZXk6YXVkaWVuY2UifQ.NfB2w1FwzW-79lhVwO8oYCkLcQYjvvmVq29GQg1ZiGNOovQswWN3Gfwtb3P4Atn-9A1oAGrmOvlFn01VmHy-CA`
      )
    })

    test('Present sd-jwt-vc from a basic payload with a disclosure', async () => {
      const sdJwt =
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6IlVXM3ZWRWp3UmYwSWt0Sm9jdktSbUdIekhmV0FMdF9YMkswd3ZsdVpJU3MifX0sImlzcyI6ImRpZDprZXk6MTIzIiwiaWF0IjoxNjk4MTUxNTMyLCJfc2RfYWxnIjoic2hhLTI1NiIsIl9zZCI6WyJ2Y3ZGVTREc0ZLVHFRMXZsNG5lbEpXWFRiXy0wZE5vQmtzNmlxTkZwdHlnIl19.IW6PaMTtxMNvqwrRac5nh7L9_ie4r-PUDL6Gqoey2O3axTm6RBrUv0ETLbdgALK6tU_HoIDuNE66DVrISQXaCw~WyJzYWx0IiwiY2xhaW0iLCJzb21lLWNsYWltIl0~'

      const sdJwtRecord = await sdJwtService.receive(agent.context, sdJwt, { issuerKey, holderKey })

      const presentation = await sdJwtService.present(agent.context, sdJwtRecord, {
        holderKey,
        verifierMetadata: {
          issuedAt: new Date().getTime() / 1000,
          audienceDid: 'did:key:audience',
          nonce: await agent.context.wallet.generateNonce(),
        },
        includedDisclosureIndices: [0],
      })

      expect(presentation).toStrictEqual(
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6IlVXM3ZWRWp3UmYwSWt0Sm9jdktSbUdIekhmV0FMdF9YMkswd3ZsdVpJU3MifX0sImlzcyI6ImRpZDprZXk6MTIzIiwiaWF0IjoxNjk4MTUxNTMyLCJfc2RfYWxnIjoic2hhLTI1NiIsIl9zZCI6WyJ2Y3ZGVTREc0ZLVHFRMXZsNG5lbEpXWFRiXy0wZE5vQmtzNmlxTkZwdHlnIl19.IW6PaMTtxMNvqwrRac5nh7L9_ie4r-PUDL6Gqoey2O3axTm6RBrUv0ETLbdgALK6tU_HoIDuNE66DVrISQXaCw~WyJzYWx0IiwiY2xhaW0iLCJzb21lLWNsYWltIl0~eyJhbGciOiJFZERTQSIsInR5cCI6ImtiK2p3dCJ9.eyJpYXQiOjE2OTgxNTE1MzIsIm5vbmNlIjoic2FsdCIsImF1ZCI6ImRpZDprZXk6YXVkaWVuY2UifQ.NfB2w1FwzW-79lhVwO8oYCkLcQYjvvmVq29GQg1ZiGNOovQswWN3Gfwtb3P4Atn-9A1oAGrmOvlFn01VmHy-CA'
      )
    })

    test('Receive sd-jwt-vc from a basic payload with multiple (nested) disclosure', async () => {
      const sdJwt =
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiZmFtaWx5X25hbWUiOiJEb2UiLCJwaG9uZV9udW1iZXIiOiIrMS0yMDItNTU1LTAxMDEiLCJhZGRyZXNzIjp7InN0cmVldF9hZGRyZXNzIjoiMTIzIE1haW4gU3QiLCJsb2NhbGl0eSI6IkFueXRvd24iLCJfc2QiOlsiTkpubWN0MEJxQk1FMUpmQmxDNmpSUVZSdWV2cEVPTmlZdzdBN01IdUp5USIsIm9tNVp6dFpIQi1HZDAwTEcyMUNWX3hNNEZhRU5Tb2lhT1huVEFKTmN6QjQiXX0sImNuZiI6eyJqd2siOnsia3R5IjoiT0tQIiwiY3J2IjoiRWQyNTUxOSIsIngiOiJVVzN2VkVqd1JmMElrdEpvY3ZLUm1HSHpIZldBTHRfWDJLMHd2bHVaSVNzIn19LCJpc3MiOiJkaWQ6a2V5OjEyMyIsImlhdCI6MTY5ODE1MTUzMiwiX3NkX2FsZyI6InNoYS0yNTYiLCJfc2QiOlsiMUN1cjJrMkEyb0lCNUNzaFNJZl9BX0tnLWwyNnVfcUt1V1E3OVAwVmRhcyIsIlIxelRVdk9ZSGdjZXBqMGpIeXBHSHo5RUh0dFZLZnQweXN3YmM5RVRQYlUiLCJlRHFRcGRUWEpYYldoZi1Fc0k3enc1WDZPdlltRk4tVVpRUU1lc1h3S1B3IiwicGREazJfWEFLSG83Z09BZndGMWI3T2RDVVZUaXQya0pIYXhTRUNROXhmYyIsInBzYXVLVU5XRWkwOW51M0NsODl4S1hnbXBXRU5abDV1eTFOMW55bl9qTWsiLCJzTl9nZTBwSFhGNnFtc1luWDFBOVNkd0o4Y2g4YUVOa3hiT0RzVDc0WXdJIl19.oKI-t9M9ie5_1gV7GkvxwEh6DVIK0ysXdzFtNJT-FwLxkm7FT5D3RkJSug2NSmnxeiYLb1Qc933Toiw6KgPqAA~WyJzYWx0IiwiaXNfb3Zlcl82NSIsdHJ1ZV0~WyJzYWx0IiwiaXNfb3Zlcl8yMSIsdHJ1ZV0~WyJzYWx0IiwiaXNfb3Zlcl8xOCIsdHJ1ZV0~WyJzYWx0IiwiYmlydGhkYXRlIiwiMTk0MC0wMS0wMSJd~WyJzYWx0IiwiZW1haWwiLCJqb2huZG9lQGV4YW1wbGUuY29tIl0~WyJzYWx0IiwicmVnaW9uIiwiQW55c3RhdGUiXQ~WyJzYWx0IiwiY291bnRyeSIsIlVTIl0~WyJzYWx0IiwiZ2l2ZW5fbmFtZSIsIkpvaG4iXQ~'

      const sdJwtRecord = await sdJwtService.receive(agent.context, sdJwt, { holderKey, issuerKey })

      const presentation = await sdJwtService.present(agent.context, sdJwtRecord, {
        holderKey,
        verifierMetadata: {
          issuedAt: new Date().getTime() / 1000,
          audienceDid: 'did:key:audience',
          nonce: await agent.context.wallet.generateNonce(),
        },
        includedDisclosureIndices: [0, 1, 4, 6, 7],
      })

      expect(presentation).toStrictEqual(
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiZmFtaWx5X25hbWUiOiJEb2UiLCJwaG9uZV9udW1iZXIiOiIrMS0yMDItNTU1LTAxMDEiLCJhZGRyZXNzIjp7InN0cmVldF9hZGRyZXNzIjoiMTIzIE1haW4gU3QiLCJsb2NhbGl0eSI6IkFueXRvd24iLCJfc2QiOlsiTkpubWN0MEJxQk1FMUpmQmxDNmpSUVZSdWV2cEVPTmlZdzdBN01IdUp5USIsIm9tNVp6dFpIQi1HZDAwTEcyMUNWX3hNNEZhRU5Tb2lhT1huVEFKTmN6QjQiXX0sImNuZiI6eyJqd2siOnsia3R5IjoiT0tQIiwiY3J2IjoiRWQyNTUxOSIsIngiOiJVVzN2VkVqd1JmMElrdEpvY3ZLUm1HSHpIZldBTHRfWDJLMHd2bHVaSVNzIn19LCJpc3MiOiJkaWQ6a2V5OjEyMyIsImlhdCI6MTY5ODE1MTUzMiwiX3NkX2FsZyI6InNoYS0yNTYiLCJfc2QiOlsiMUN1cjJrMkEyb0lCNUNzaFNJZl9BX0tnLWwyNnVfcUt1V1E3OVAwVmRhcyIsIlIxelRVdk9ZSGdjZXBqMGpIeXBHSHo5RUh0dFZLZnQweXN3YmM5RVRQYlUiLCJlRHFRcGRUWEpYYldoZi1Fc0k3enc1WDZPdlltRk4tVVpRUU1lc1h3S1B3IiwicGREazJfWEFLSG83Z09BZndGMWI3T2RDVVZUaXQya0pIYXhTRUNROXhmYyIsInBzYXVLVU5XRWkwOW51M0NsODl4S1hnbXBXRU5abDV1eTFOMW55bl9qTWsiLCJzTl9nZTBwSFhGNnFtc1luWDFBOVNkd0o4Y2g4YUVOa3hiT0RzVDc0WXdJIl19.oKI-t9M9ie5_1gV7GkvxwEh6DVIK0ysXdzFtNJT-FwLxkm7FT5D3RkJSug2NSmnxeiYLb1Qc933Toiw6KgPqAA~WyJzYWx0IiwiaXNfb3Zlcl82NSIsdHJ1ZV0~WyJzYWx0IiwiaXNfb3Zlcl8yMSIsdHJ1ZV0~WyJzYWx0IiwiZW1haWwiLCJqb2huZG9lQGV4YW1wbGUuY29tIl0~WyJzYWx0IiwiY291bnRyeSIsIlVTIl0~WyJzYWx0IiwiZ2l2ZW5fbmFtZSIsIkpvaG4iXQ~eyJhbGciOiJFZERTQSIsInR5cCI6ImtiK2p3dCJ9.eyJpYXQiOjE2OTgxNTE1MzIsIm5vbmNlIjoic2FsdCIsImF1ZCI6ImRpZDprZXk6YXVkaWVuY2UifQ.NfB2w1FwzW-79lhVwO8oYCkLcQYjvvmVq29GQg1ZiGNOovQswWN3Gfwtb3P4Atn-9A1oAGrmOvlFn01VmHy-CA'
      )
    })
  })

  describe('SdJwtService.verify', () => {
    test('Verify sd-jwt-vc without disclosures', async () => {
      const sdJwt =
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJjbGFpbSI6InNvbWUtY2xhaW0iLCJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6IlVXM3ZWRWp3UmYwSWt0Sm9jdktSbUdIekhmV0FMdF9YMkswd3ZsdVpJU3MifX0sImlzcyI6ImRpZDprZXk6MTIzIiwiaWF0IjoxNjk4MTUxNTMyfQ.pHv5oFJ6NGadsoY4iwVCuNt6DI-vxCLsvPJulr8KSpMM5ga39fLdCKPJ-DWCdGmbCnsuIJb04Z6SyH8bp-bbAw'

      const sdJwtRecord = await sdJwtService.receive(agent.context, sdJwt, { issuerKey, holderKey })

      const presentation = await sdJwtService.present(agent.context, sdJwtRecord, {
        holderKey,
        verifierMetadata: {
          issuedAt: new Date().getTime() / 1000,
          audienceDid: 'did:key:audience',
          nonce: await agent.context.wallet.generateNonce(),
        },
      })

      const { validation } = await sdJwtService.verify(agent.context, presentation, {
        verifierDid: 'did:key:audience',
        issuerKey,
        requiredClaimKeys: ['claim'],
        holderKey,
      })

      expect(validation).toMatchObject({
        isSignatureValid: true,
        areRequiredClaimsIncluded: true,
        isValid: true,
        isKeyBindingValid: true,
      })
    })

    test('Verify sd-jwt-vc with a disclosure', async () => {
      const sdJwt =
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6IlVXM3ZWRWp3UmYwSWt0Sm9jdktSbUdIekhmV0FMdF9YMkswd3ZsdVpJU3MifX0sImlzcyI6ImRpZDprZXk6MTIzIiwiaWF0IjoxNjk4MTUxNTMyLCJfc2RfYWxnIjoic2hhLTI1NiIsIl9zZCI6WyJ2Y3ZGVTREc0ZLVHFRMXZsNG5lbEpXWFRiXy0wZE5vQmtzNmlxTkZwdHlnIl19.IW6PaMTtxMNvqwrRac5nh7L9_ie4r-PUDL6Gqoey2O3axTm6RBrUv0ETLbdgALK6tU_HoIDuNE66DVrISQXaCw~WyJzYWx0IiwiY2xhaW0iLCJzb21lLWNsYWltIl0~'

      const sdJwtRecord = await sdJwtService.receive(agent.context, sdJwt, { issuerKey, holderKey })

      const presentation = await sdJwtService.present(agent.context, sdJwtRecord, {
        holderKey,
        verifierMetadata: {
          issuedAt: new Date().getTime() / 1000,
          audienceDid: 'did:key:audience',
          nonce: await agent.context.wallet.generateNonce(),
        },
        includedDisclosureIndices: [0],
      })

      const { validation } = await sdJwtService.verify(agent.context, presentation, {
        verifierDid: 'did:key:audience',
        issuerKey,
        requiredClaimKeys: ['type', 'cnf', 'claim', 'iat'],
        holderKey,
      })

      expect(validation).toMatchObject({
        isSignatureValid: true,
        areRequiredClaimsIncluded: true,
        isValid: true,
        isKeyBindingValid: true,
      })
    })

    test('Receive sd-jwt-vc with multiple (nested) disclosure', async () => {
      const sdJwt =
        'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCJ9.eyJ0eXBlIjoiSWRlbnRpdHlDcmVkZW50aWFsIiwiZmFtaWx5X25hbWUiOiJEb2UiLCJwaG9uZV9udW1iZXIiOiIrMS0yMDItNTU1LTAxMDEiLCJhZGRyZXNzIjp7InN0cmVldF9hZGRyZXNzIjoiMTIzIE1haW4gU3QiLCJsb2NhbGl0eSI6IkFueXRvd24iLCJfc2QiOlsiTkpubWN0MEJxQk1FMUpmQmxDNmpSUVZSdWV2cEVPTmlZdzdBN01IdUp5USIsIm9tNVp6dFpIQi1HZDAwTEcyMUNWX3hNNEZhRU5Tb2lhT1huVEFKTmN6QjQiXX0sImNuZiI6eyJqd2siOnsia3R5IjoiT0tQIiwiY3J2IjoiRWQyNTUxOSIsIngiOiJVVzN2VkVqd1JmMElrdEpvY3ZLUm1HSHpIZldBTHRfWDJLMHd2bHVaSVNzIn19LCJpc3MiOiJkaWQ6a2V5OjEyMyIsImlhdCI6MTY5ODE1MTUzMiwiX3NkX2FsZyI6InNoYS0yNTYiLCJfc2QiOlsiMUN1cjJrMkEyb0lCNUNzaFNJZl9BX0tnLWwyNnVfcUt1V1E3OVAwVmRhcyIsIlIxelRVdk9ZSGdjZXBqMGpIeXBHSHo5RUh0dFZLZnQweXN3YmM5RVRQYlUiLCJlRHFRcGRUWEpYYldoZi1Fc0k3enc1WDZPdlltRk4tVVpRUU1lc1h3S1B3IiwicGREazJfWEFLSG83Z09BZndGMWI3T2RDVVZUaXQya0pIYXhTRUNROXhmYyIsInBzYXVLVU5XRWkwOW51M0NsODl4S1hnbXBXRU5abDV1eTFOMW55bl9qTWsiLCJzTl9nZTBwSFhGNnFtc1luWDFBOVNkd0o4Y2g4YUVOa3hiT0RzVDc0WXdJIl19.oKI-t9M9ie5_1gV7GkvxwEh6DVIK0ysXdzFtNJT-FwLxkm7FT5D3RkJSug2NSmnxeiYLb1Qc933Toiw6KgPqAA~WyJzYWx0IiwiaXNfb3Zlcl82NSIsdHJ1ZV0~WyJzYWx0IiwiaXNfb3Zlcl8yMSIsdHJ1ZV0~WyJzYWx0IiwiaXNfb3Zlcl8xOCIsdHJ1ZV0~WyJzYWx0IiwiYmlydGhkYXRlIiwiMTk0MC0wMS0wMSJd~WyJzYWx0IiwiZW1haWwiLCJqb2huZG9lQGV4YW1wbGUuY29tIl0~WyJzYWx0IiwicmVnaW9uIiwiQW55c3RhdGUiXQ~WyJzYWx0IiwiY291bnRyeSIsIlVTIl0~WyJzYWx0IiwiZ2l2ZW5fbmFtZSIsIkpvaG4iXQ~'

      const sdJwtRecord = await sdJwtService.receive(agent.context, sdJwt, { holderKey, issuerKey })

      const presentation = await sdJwtService.present(agent.context, sdJwtRecord, {
        holderKey,
        verifierMetadata: {
          issuedAt: new Date().getTime() / 1000,
          audienceDid: 'did:key:audience',
          nonce: await agent.context.wallet.generateNonce(),
        },
        includedDisclosureIndices: [0, 1, 4, 6, 7],
      })

      const { validation } = await sdJwtService.verify(agent.context, presentation, {
        verifierDid: 'did:key:audience',
        issuerKey,
        requiredClaimKeys: [
          'type',
          'family_name',
          'phone_number',
          'address',
          'cnf',
          'iss',
          'iat',
          'is_over_65',
          'is_over_21',
          'email',
          'given_name',
          'street_address',
          'locality',
          'country',
        ],
        holderKey,
      })

      expect(validation).toMatchObject({
        isSignatureValid: true,
        areRequiredClaimsIncluded: true,
        isValid: true,
        isKeyBindingValid: true,
      })
    })
  })
})
