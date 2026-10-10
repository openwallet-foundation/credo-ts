import { Agent, DidKey, SdJwtVcRecord, TypedArrayEncoder } from '@credo-ts/core'
import nock, { cleanAll } from 'nock'
import { transformSeedToPrivateJwk } from '../../../../../askar/src'
import { getAgentOptions } from '../../../../tests'
import { PublicJwk } from '../../kms'

const issuer = new Agent(getAgentOptions('sd-jwt-vc-issuer-agent'))
const holder = new Agent(getAgentOptions('sd-jwt-vc-holder-agent'))

describe('sd-jwt-vc end to end test', () => {
  let issuerKey: PublicJwk
  let issuerDidUrl: string

  let holderKey: PublicJwk

  const verifier = new Agent(getAgentOptions('sd-jwt-vc-verifier-agent'))
  const verifierDid = 'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y'

  beforeAll(async () => {
    await issuer.initialize()

    const issuerPrivateJwk = transformSeedToPrivateJwk({
      seed: TypedArrayEncoder.fromUtf8String('00000000000000000000000000000000'),
      type: {
        crv: 'Ed25519',
        kty: 'OKP',
      },
    }).privateJwk
    issuerKey = PublicJwk.fromPublicJwk(
      (
        await issuer.kms.importKey({
          privateJwk: issuerPrivateJwk,
        })
      ).publicJwk
    )

    const issuerDidKey = new DidKey(issuerKey)
    const issuerDidDocument = issuerDidKey.didDocument
    issuerDidUrl = (issuerDidDocument.verificationMethod ?? [])[0].id
    await issuer.dids.import({
      didDocument: issuerDidDocument,
      did: issuerDidDocument.id,
      keys: [
        {
          didDocumentRelativeKeyId: `#${issuerDidUrl.split('#')[1]}`,
          kmsKeyId: issuerKey.keyId,
        },
      ],
    })

    await holder.initialize()
    const holderPrivateJwk = transformSeedToPrivateJwk({
      seed: TypedArrayEncoder.fromUtf8String('00000000000000000000000000000001'),
      type: {
        crv: 'Ed25519',
        kty: 'OKP',
      },
    }).privateJwk
    holderKey = PublicJwk.fromPublicJwk(
      (
        await holder.kms.importKey({
          privateJwk: holderPrivateJwk,
        })
      ).publicJwk
    )

    await verifier.initialize()
  })

  test('end to end flow', async () => {
    nock('https://example.com').get('/.well-known/vct/vct-type').reply(200, { vct: 'https://example.com/vct-type' })

    const credential = {
      vct: 'https://example.com/vct-type',
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
    } as const

    const { compact, header, payload } = await issuer.sdJwtVc.sign({
      payload: credential,
      holder: {
        method: 'jwk',
        jwk: holderKey,
      },
      issuer: {
        didUrl: issuerDidUrl,
        method: 'did',
      },
      disclosureFrame: {
        _sd: [
          'is_over_65',
          'is_over_21',
          'is_over_18',
          'birthdate',
          'email',
          'given_name',
          'family_name',
          'phone_number',
        ],
        _sd_decoy: 2,
        address: {
          _sd: ['country', 'region', 'locality', 'street_address'],
          _sd_decoy: 2,
        },
      },
    })

    type Payload = typeof payload
    type Header = typeof header

    // parse SD-JWT
    const sdJwtVc = holder.sdJwtVc.fromCompact<Header, Payload>(compact)
    sdJwtVc.kmsKeyId = holderKey.keyId
    expect(sdJwtVc).toEqual({
      kmsKeyId: holderKey.keyId,
      claimFormat: 'dc+sd-jwt',
      compact: expect.any(String),
      encoded: expect.any(String),
      kbJwt: undefined,
      issuer: {
        method: 'did',
        didUrl:
          'did:key:z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW',
      },
      holder: {
        jwk: {
          jwk: {
            jwk: {
              crv: 'Ed25519',
              kty: 'OKP',
              x: 'oENVsxOUiH54X8wJLaVkicCRk00wBIQ4sRgbk54N8Mo',
            },
            multicodecPrefix: 237,
            supportedEncryptionKeyAgreementAlgorithms: [],
            supportedSignatureAlgorithms: ['EdDSA', 'Ed25519'],
          },
        },
        method: 'jwk',
      },
      header: {
        alg: 'EdDSA',
        kid: '#z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW',
        typ: 'dc+sd-jwt',
      },
      payload: {
        _sd: [
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.any(String),
        ],
        _sd_alg: 'sha-256',
        address: {
          _sd: [
            expect.any(String),
            expect.any(String),
            expect.any(String),
            expect.any(String),
            expect.any(String),
            expect.any(String),
          ],
        },
        cnf: {
          jwk: {
            crv: 'Ed25519',
            kty: 'OKP',
            x: 'oENVsxOUiH54X8wJLaVkicCRk00wBIQ4sRgbk54N8Mo',
          },
        },
        iat: expect.any(Number),
        iss: 'did:key:z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW',
        vct: 'https://example.com/vct-type',
      },
      prettyClaims: {
        address: {
          country: 'US',
          locality: 'Anytown',
          region: 'Anystate',
          street_address: '123 Main St',
        },
        birthdate: '1940-01-01',
        cnf: {
          jwk: {
            crv: 'Ed25519',
            kty: 'OKP',
            x: 'oENVsxOUiH54X8wJLaVkicCRk00wBIQ4sRgbk54N8Mo',
          },
        },
        email: 'johndoe@example.com',
        family_name: 'Doe',
        given_name: 'John',
        iat: expect.any(Number),
        is_over_18: true,
        is_over_21: true,
        is_over_65: true,
        iss: 'did:key:z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW',
        phone_number: '+1-202-555-0101',
        vct: 'https://example.com/vct-type',
      },
      typeMetadata: undefined,
    })

    // Verify SD-JWT (does not require key binding)
    const verificationResult = await holder.sdJwtVc.verify({
      compactSdJwtVc: compact,
      fetchTypeMetadata: true,
    })
    expect(verificationResult.isValid).toBe(true)
    expect(verificationResult.sdJwtVc?.typeMetadata).toEqual({
      vct: 'https://example.com/vct-type',
    })

    // Store credential
    await holder.sdJwtVc.store({
      record: new SdJwtVcRecord({
        credentialInstances: [
          {
            compactSdJwtVc: compact,
            kmsKeyId: holderKey.keyId,
          },
        ],
      }),
    })

    // Metadata created by the verifier and send out of band by the verifier to the holder
    const verifierMetadata = {
      audience: verifierDid,
      issuedAt: Date.now() / 1000,
      nonce: TypedArrayEncoder.toBase64Url(verifier.kms.randomBytes({ length: 32 })),
    }

    const presentation = await holder.sdJwtVc.present<Payload>({
      sdJwtVc,
      verifierMetadata,
      presentationFrame: {
        given_name: true,
        family_name: true,
        email: true,
        phone_number: true,
        address: {
          street_address: true,
          locality: true,
          region: true,
          country: true,
        },
        birthdate: true,
        is_over_18: true,
        is_over_21: true,
        is_over_65: true,
      },
    })

    const { isValid } = await verifier.sdJwtVc.verify({
      compactSdJwtVc: presentation,
      keyBinding: { audience: verifierDid, nonce: verifierMetadata.nonce },
      requiredClaimKeys: [
        'is_over_65',
        'is_over_21',
        'is_over_18',
        'birthdate',
        'email',
        'address.country',
        'address.region',
        'address.locality',
        'address',
        'address.street_address',
        'given_name',
        'family_name',
        'phone_number',
      ],
    })

    expect(isValid).toBe(true)

    cleanAll()
  })

  describe('DID holder end to end flow', () => {
    let holderDidUrl: string

    beforeAll(async () => {
      const holderDidDocument = new DidKey(holderKey).didDocument
      const verificationMethodId = holderDidDocument.verificationMethod?.[0]?.id
      if (!verificationMethodId) throw new Error('Expected a holder DID verification method')
      holderDidUrl = verificationMethodId

      await holder.dids.import({
        did: holderDidDocument.id,
        didDocument: holderDidDocument,
        keys: [{ didDocumentRelativeKeyId: `#${holderDidUrl.split('#')[1]}`, kmsKeyId: holderKey.keyId }],
      })
    })

    test('uses cnf.kid by default across issuer, holder and verifier agents', async () => {
      const { compact, payload } = await issuer.sdJwtVc.sign({
        payload: { vct: 'https://example.com/vct-type', given_name: 'John' },
        disclosureFrame: { _sd: ['given_name'] },
        holder: { method: 'did', didUrl: holderDidUrl },
        issuer: { method: 'did', didUrl: issuerDidUrl },
      })

      expect(payload.cnf).toEqual({ kid: holderDidUrl })

      const credential = holder.sdJwtVc.fromCompact(compact)
      expect(credential.payload.cnf).toEqual({ kid: holderDidUrl })

      await holder.sdJwtVc.store({
        record: new SdJwtVcRecord({ credentialInstances: [{ compactSdJwtVc: compact }] }),
      })

      const verifierMetadata = {
        audience: verifierDid,
        issuedAt: Date.now() / 1000,
        nonce: TypedArrayEncoder.toBase64Url(verifier.kms.randomBytes({ length: 32 })),
      }
      const presentation = await holder.sdJwtVc.present({
        sdJwtVc: credential,
        verifierMetadata,
        presentationFrame: { given_name: true },
      })

      const result = await verifier.sdJwtVc.verify({
        compactSdJwtVc: presentation,
        keyBinding: { audience: verifierDid, nonce: verifierMetadata.nonce },
        requiredClaimKeys: ['given_name'],
      })

      expect(result.isValid).toBe(true)
      expect(result.sdJwtVc?.prettyClaims.given_name).toBe('John')
    })
  })

  test('DID-selected holder key opts in to JWK binding across issuer, holder and verifier agents', async () => {
    const holderDidUrl = new DidKey(holderKey).didDocument.verificationMethod?.[0]?.id
    if (!holderDidUrl) throw new Error('Expected a holder DID verification method')

    const { compact, payload } = await issuer.sdJwtVc.sign({
      payload: { vct: 'https://example.com/vct-type', given_name: 'John' },
      disclosureFrame: { _sd: ['given_name'] },
      holder: { method: 'did', didUrl: holderDidUrl, cnf: 'jwk' },
      issuer: { method: 'did', didUrl: issuerDidUrl },
    })

    // The fixture holder key's local kid is not included in the issued cnf.jwk.
    const expectedCnf = { jwk: holderKey.toJson({ includeKid: false }) }
    expect(payload.cnf).toEqual(expectedCnf)

    const credential = holder.sdJwtVc.fromCompact(compact)
    expect(credential.payload.cnf).toEqual(expectedCnf)
    credential.kmsKeyId = holderKey.keyId

    await holder.sdJwtVc.store({
      record: new SdJwtVcRecord({
        credentialInstances: [{ compactSdJwtVc: compact, kmsKeyId: holderKey.keyId }],
      }),
    })

    const verifierMetadata = {
      audience: verifierDid,
      issuedAt: Date.now() / 1000,
      nonce: TypedArrayEncoder.toBase64Url(verifier.kms.randomBytes({ length: 32 })),
    }
    const presentation = await holder.sdJwtVc.present({
      sdJwtVc: credential,
      verifierMetadata,
      presentationFrame: { given_name: true },
    })

    const result = await verifier.sdJwtVc.verify({
      compactSdJwtVc: presentation,
      keyBinding: { audience: verifierDid, nonce: verifierMetadata.nonce },
      requiredClaimKeys: ['given_name'],
    })

    expect(result.isValid).toBe(true)
    expect(result.sdJwtVc?.prettyClaims.given_name).toBe('John')
  })
})
