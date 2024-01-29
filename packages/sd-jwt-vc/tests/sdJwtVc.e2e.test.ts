import type { Key } from '@credo-ts/core'

import { AskarModule } from '@credo-ts/askar'
import {
  Agent,
  DidKey,
  DidsModule,
  KeyDidRegistrar,
  KeyDidResolver,
  KeyType,
  TypedArrayEncoder,
  utils,
} from '@credo-ts/core'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'

import { agentDependencies } from '../../core/tests'
import { SdJwtVcModule } from '../src'

const getAgent = (label: string) =>
  new Agent({
    config: { label, walletConfig: { id: utils.uuid(), key: utils.uuid() } },
    modules: {
      sdJwt: new SdJwtVcModule(),
      askar: new AskarModule({ ariesAskar }),
      dids: new DidsModule({
        resolvers: [new KeyDidResolver()],
        registrars: [new KeyDidRegistrar()],
      }),
    },
    dependencies: agentDependencies,
  })

describe('sd-jwt-vc end to end test', () => {
  const issuer = getAgent('sdjwtvcissueragent')
  let issuerKey: Key
  let issuerDidUrl: string

  const holder = getAgent('sdjwtvcholderagent')
  let holderKey: Key
  let holderDidUrl: string

  const verifier = getAgent('sdjwtvcverifieragent')
  const verifierDid = 'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y'

  beforeAll(async () => {
    await issuer.initialize()
    issuerKey = await issuer.context.wallet.createKey({
      keyType: KeyType.Ed25519,
      seed: TypedArrayEncoder.fromString('00000000000000000000000000000000'),
    })

    const issuerDidKey = new DidKey(issuerKey)
    const issuerDidDocument = issuerDidKey.didDocument
    issuerDidUrl = (issuerDidDocument.verificationMethod ?? [])[0].id
    await issuer.dids.import({ didDocument: issuerDidDocument, did: issuerDidDocument.id })

    await holder.initialize()
    holderKey = await holder.context.wallet.createKey({
      keyType: KeyType.Ed25519,
      seed: TypedArrayEncoder.fromString('00000000000000000000000000000001'),
    })

    const holderDidKey = new DidKey(holderKey)
    const holderDidDocument = holderDidKey.didDocument
    holderDidUrl = (holderDidDocument.verificationMethod ?? [])[0].id
    await holder.dids.import({ didDocument: holderDidDocument, did: holderDidDocument.id })

    await verifier.initialize()
  })

  test('end to end flow', async () => {
    const credential = {
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
    }

    const { compact } = await issuer.modules.sdJwt.create(credential, {
      holderDidUrl,
      issuerDidUrl,
      disclosureFrame: {
        is_over_65: true,
        is_over_21: true,
        is_over_18: true,
        birthdate: true,
        email: true,
        address: { country: true, region: true, locality: true, __decoyCount: 2, street_address: true },
        __decoyCount: 2,
        given_name: true,
        family_name: true,
        phone_number: true,
      },
    })

    const sdJwtVcRecord = await holder.modules.sdJwt.storeCredential(compact, { issuerDidUrl, holderDidUrl })

    // Metadata created by the verifier and send out of band by the verifier to the holder
    const verifierMetadata = {
      verifierDid,
      issuedAt: new Date().getTime() / 1000,
      nonce: await verifier.wallet.generateNonce(),
    }

    const presentation = await holder.modules.sdJwt.present(sdJwtVcRecord, {
      verifierMetadata,
      includedDisclosureIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    })

    const {
      validation: { isValid },
    } = await verifier.modules.sdJwt.verify(presentation, {
      holderDidUrl,
      challenge: { verifierDid },
      requiredClaimKeys: [
        'is_over_65',
        'is_over_21',
        'is_over_18',
        'birthdate',
        'email',
        'country',
        'region',
        'locality',
        'street_address',
        'given_name',
        'family_name',
        'phone_number',
      ],
    })

    expect(isValid).toBeTruthy()
  })
})
