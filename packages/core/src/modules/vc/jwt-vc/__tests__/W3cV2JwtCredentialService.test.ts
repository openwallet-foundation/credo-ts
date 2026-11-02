import { NativeAskar } from '@openwallet-foundation/askar-nodejs'
import { Subject } from 'rxjs'
import { InMemoryStorageService } from '../../../../../../../tests/InMemoryStorageService'
import { AskarKeyManagementService, AskarModuleConfig, transformSeedToPrivateJwk } from '../../../../../../askar/src'
import { AskarStoreManager } from '../../../../../../askar/src/AskarStoreManager'
import { NodeFileSystem } from '../../../../../../node/src/NodeFileSystem'
import {
  agentDependencies,
  getAgentConfig,
  getAgentContext,
  getAskarStoreConfig,
  testLogger,
} from '../../../../../tests'
import { EventEmitter } from '../../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../../constants'
import { JwsService, JwtPayload } from '../../../../crypto'
import { ClassValidationError, CredoError } from '../../../../error'
import { JsonTransformer, TypedArrayEncoder } from '../../../../utils'
import { CacheModuleConfig, InMemoryLruCache } from '../../../cache'
import {
  DidDocument,
  DidJwk,
  DidKey,
  DidRepository,
  DidsApi,
  DidsModuleConfig,
  getJsonWebKey2020,
  VerificationMethod,
} from '../../../dids'
import { KeyManagementApi, KnownJwaSignatureAlgorithms, PublicJwk, publicJwkFromPrivateJwk } from '../../../kms'
import { X509ModuleConfig } from '../../../x509/X509ModuleConfig'
import { CREDENTIALS_CONTEXT_V2_URL, CREDENTIALS_UNDEFINED_TERMS_V2_URL } from '../../constants'
import {
  ClaimFormat,
  W3cV2Credential,
  W3cV2CredentialStatus,
  W3cV2EnvelopedVerifiableCredential,
  W3cV2Presentation,
} from '../../models'
import { W3cV2CredentialService } from '../../W3cV2CredentialService'
import type { W3cV2JwtSignCredentialOptions } from '../../W3cV2CredentialServiceOptions'
import { W3cV2JwtCredentialService } from '../W3cV2JwtCredentialService'
import { W3cV2JwtVerifiableCredential } from '../W3cV2JwtVerifiableCredential'
import { W3cV2JwtVerifiablePresentation } from '../W3cV2JwtVerifiablePresentation'
import {
  CredoEs256DidJwkJwtVc,
  CredoEs256DidJwkJwtVcIssuerSeed,
  CredoEs256DidJwkJwtVcSubjectSeed,
  CredoEs256DidKeyJwtVp,
  Ed256DidJwkJwtVcUnsigned,
} from './fixtures/credo-jwt-vc-v2'

// biome-ignore lint/suspicious/noExplicitAny: no explanation
const storageService = new InMemoryStorageService<any>()
const config = getAgentConfig('W3cV2JwtCredentialService')
const askarModuleConfig = new AskarModuleConfig({
  askar: NativeAskar,
  store: getAskarStoreConfig('W3cV2JwtCredentialService'),
})
const agentContext = getAgentContext({
  registerInstances: [
    [InjectionSymbols.Logger, testLogger],
    [DidsModuleConfig, new DidsModuleConfig()],
    [DidRepository, new DidRepository(storageService, new EventEmitter(agentDependencies, new Subject()))],
    [InjectionSymbols.StorageService, storageService],
    [X509ModuleConfig, new X509ModuleConfig()],
    [AskarModuleConfig, askarModuleConfig],
    [AskarStoreManager, new AskarStoreManager(new NodeFileSystem(), askarModuleConfig)],
    [
      CacheModuleConfig,
      new CacheModuleConfig({
        cache: new InMemoryLruCache({ limit: 500 }),
      }),
    ],
  ],
  kmsBackends: [new AskarKeyManagementService()],
  agentConfig: config,
})

const kms = agentContext.dependencyManager.resolve(KeyManagementApi)

kms.randomBytes = vi.fn(function () {
  return TypedArrayEncoder.fromUtf8String('salt')
})
Date.prototype.getTime = vi.fn(function () {
  return 1698151532000
})

const dids = agentContext.dependencyManager.resolve(DidsApi)
const jwsService = new JwsService()
const w3cV2JwtCredentialService = new W3cV2JwtCredentialService(jwsService)

describe('W3cV2JwtCredentialService', () => {
  let issuerDidJwk: DidJwk
  let holderDidKey: DidKey
  let holderDidJwk: DidJwk
  let secondHolderDidKey: DidKey

  beforeAll(async () => {
    const issuerPrivateJwk = transformSeedToPrivateJwk({
      type: {
        kty: 'EC',
        crv: 'P-256',
      },
      seed: CredoEs256DidJwkJwtVcIssuerSeed,
    }).privateJwk

    const importedIssuerKey = await kms.importKey({
      privateJwk: issuerPrivateJwk,
    })

    issuerDidJwk = DidJwk.fromPublicJwk(PublicJwk.fromPublicJwk(importedIssuerKey.publicJwk))
    await dids.import({
      did: issuerDidJwk.did,
      keys: [
        {
          didDocumentRelativeKeyId: '#0',
          kmsKeyId: importedIssuerKey.keyId,
        },
      ],
    })

    const holderPrivateJwk = transformSeedToPrivateJwk({
      type: {
        kty: 'OKP',
        crv: 'Ed25519',
      },
      seed: CredoEs256DidJwkJwtVcSubjectSeed,
    }).privateJwk

    const importedHolderKey = await kms.importKey({
      privateJwk: holderPrivateJwk,
    })

    holderDidKey = new DidKey(PublicJwk.fromPublicJwk(importedHolderKey.publicJwk))
    await dids.import({
      did: holderDidKey.did,
      keys: [
        {
          didDocumentRelativeKeyId: `#${holderDidKey.publicJwk.fingerprint}`,
          kmsKeyId: importedHolderKey.keyId,
        },
      ],
    })

    holderDidJwk = DidJwk.fromPublicJwk(holderDidKey.publicJwk)
    await dids.import({
      did: holderDidJwk.did,
      keys: [{ didDocumentRelativeKeyId: '#0', kmsKeyId: importedHolderKey.keyId }],
    })

    const secondHolderPrivateJwk = transformSeedToPrivateJwk({
      type: {
        kty: 'OKP',
        crv: 'Ed25519',
      },
      seed: TypedArrayEncoder.fromUtf8String('00000000000000000000000000000My2'),
    }).privateJwk

    const importedSecondHolderKey = await kms.importKey({
      privateJwk: secondHolderPrivateJwk,
    })

    secondHolderDidKey = new DidKey(PublicJwk.fromPublicJwk(importedSecondHolderKey.publicJwk))
    await dids.import({
      did: secondHolderDidKey.did,
      keys: [
        {
          didDocumentRelativeKeyId: `#${secondHolderDidKey.publicJwk.fingerprint}`,
          kmsKeyId: importedSecondHolderKey.keyId,
        },
      ],
    })
  })

  describe('signCredential', () => {
    test('signs an ES256 JWT vc', async () => {
      const credential = JsonTransformer.fromJSON(Ed256DidJwkJwtVcUnsigned, W3cV2Credential)

      const nowMock = vi.spyOn(Date, 'now')
      nowMock.mockReturnValueOnce(1698151532000)

      const vcJwt = await w3cV2JwtCredentialService.signCredential(agentContext, {
        alg: KnownJwaSignatureAlgorithms.ES256,
        format: ClaimFormat.JwtW3cVc,
        verificationMethod: issuerDidJwk.verificationMethodId,
        holder: {
          method: 'did',
          didUrl: `${holderDidKey.did}#${holderDidKey.publicJwk.fingerprint}`,
        },
        credential,
      })

      expect(vcJwt.encoded).toEqual(CredoEs256DidJwkJwtVc)
    })

    test('throws when invalid credential is passed', async () => {
      const credentialJson = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        type: ['VerifiableCredential'],
        issuer:
          'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6InpRT293SUMxZ1dKdGRkZEI1R0F0NGxhdTZMdDhJaHk3NzFpQWZhbS0xcGMiLCJ5IjoiY2pEXzdvM2dkUTF2Z2lReTNfc01HczdXcndDTVU5RlFZaW1BM0h4bk1sdyJ9',
        validFrom: '2023-01-25T16:58:06.292Z',
        credentialSubject: {
          id: 'did:key:z6MkqgkLrRyLg6bqk27djwbbaQWgaSYgFVCKq9YKxZbNkpVv',
        },
      }

      // Throw when verificationMethod is not a did
      await expect(
        w3cV2JwtCredentialService.signCredential(agentContext, {
          verificationMethod: 'hello',
          alg: KnownJwaSignatureAlgorithms.ES256,
          credential: JsonTransformer.fromJSON(credentialJson, W3cV2Credential),
          format: ClaimFormat.JwtW3cVc,
        })
      ).rejects.toThrow('Only did identifiers are supported as verification method')

      // Does not allow vc property
      await expect(
        w3cV2JwtCredentialService.signCredential(agentContext, {
          verificationMethod: 'hello',
          alg: KnownJwaSignatureAlgorithms.ES256,
          credential: JsonTransformer.fromJSON({ ...credentialJson, vc: 'test' }, W3cV2Credential, { validate: false }),
          format: ClaimFormat.JwtW3cVc,
        })
      ).rejects.toThrow(/property vc has failed the following constraints: vc is forbidden/)

      // Does not allow vp property
      await expect(
        w3cV2JwtCredentialService.signCredential(agentContext, {
          verificationMethod: 'hello',
          alg: KnownJwaSignatureAlgorithms.ES256,
          credential: JsonTransformer.fromJSON({ ...credentialJson, vp: 'test' }, W3cV2Credential, { validate: false }),
          format: ClaimFormat.JwtW3cVc,
        })
      ).rejects.toThrow(/property vp has failed the following constraints: vp is forbidden/)

      // Throw when not according to data model
      await expect(
        w3cV2JwtCredentialService.signCredential(agentContext, {
          verificationMethod: issuerDidJwk.verificationMethodId,
          alg: KnownJwaSignatureAlgorithms.ES256,
          credential: JsonTransformer.fromJSON({ ...credentialJson, validFrom: '2020' }, W3cV2Credential, {
            validate: false,
          }),
          format: ClaimFormat.JwtW3cVc,
        })
      ).rejects.toThrow('property validFrom has failed the following constraints: validFrom must be RFC 3339 date')

      // Throw when verificationMethod id does not exist in did document
      await expect(
        w3cV2JwtCredentialService.signCredential(agentContext, {
          verificationMethod: `${issuerDidJwk.verificationMethodId}extra`,
          alg: KnownJwaSignatureAlgorithms.ES256,
          credential: JsonTransformer.fromJSON(credentialJson, W3cV2Credential),
          format: ClaimFormat.JwtW3cVc,
        })
      ).rejects.toThrow(
        `Unable to locate verification method with id 'did:jwk:eyJrdHkiOiJFQyIsImNydiI6IlAtMjU2IiwieCI6InpRT293SUMxZ1dKdGRkZEI1R0F0NGxhdTZMdDhJaHk3NzFpQWZhbS0xcGMiLCJ5IjoiY2pEXzdvM2dkUTF2Z2lReTNfc01HczdXcndDTVU5RlFZaW1BM0h4bk1sdyJ9#0extra' in purposes assertionMethod`
      )
    })
  })

  describe('verifyCredential', () => {
    test('verifies an ES256 JWT vc signed by Credo', async () => {
      const result = await w3cV2JwtCredentialService.verifyCredential(agentContext, {
        credential: CredoEs256DidJwkJwtVc,
      })

      expect(result).toEqual({
        isValid: true,
        validations: {
          // This both validates whether the credential matches the
          // data model, as well as whether the credential is expired etc..
          dataModel: {
            isValid: true,
          },
          validityPeriod: {
            isValid: true,
          },
          // This validates whether the signature is valid
          signature: {
            isValid: true,
          },
          credentialStatus: {
            isValid: true,
          },
          // This validates whether the issuer is also the signer of the credential
          issuerIsSigner: {
            isValid: true,
          },
        },
      })
    })

    test('returns invalid result when credential is not according to data model', async () => {
      const jwtVc = W3cV2JwtVerifiableCredential.fromCompact(CredoEs256DidJwkJwtVc)

      // @ts-expect-error
      jwtVc.resolvedCredential.issuer = undefined

      const result = await w3cV2JwtCredentialService.verifyCredential(agentContext, {
        credential: jwtVc,
      })

      expect(result).toEqual({
        isValid: false,
        validations: {
          dataModel: {
            isValid: false,
            error: expect.any(ClassValidationError),
          },
        },
      })

      expect(result.validations.dataModel?.error?.message).toContain('Failed to validate class')
    })

    test('returns invalid result when credential is not according to data model', async () => {
      const jwtVc = W3cV2JwtVerifiableCredential.fromCompact(CredoEs256DidJwkJwtVc)

      // @ts-expect-error
      jwtVc.resolvedCredential.vc = 'HELLO'

      const result = await w3cV2JwtCredentialService.verifyCredential(agentContext, {
        credential: jwtVc,
      })

      expect(result).toEqual({
        isValid: false,
        validations: {
          dataModel: {
            isValid: false,
            error: expect.any(ClassValidationError),
          },
        },
      })

      expect(result.validations.dataModel?.error?.message).toContain('Failed to validate class')
    })

    test('returns invalid result when credential is expired', async () => {
      const jwtVc = W3cV2JwtVerifiableCredential.fromCompact(CredoEs256DidJwkJwtVc)

      jwtVc.jwt.payload.exp = 1577836800

      const result = await w3cV2JwtCredentialService.verifyCredential(agentContext, {
        credential: jwtVc,
      })

      expect(result).toEqual({
        isValid: false,
        validations: {
          dataModel: {
            isValid: false,
            error: expect.any(CredoError),
          },
        },
      })

      expect(result.validations.dataModel?.error?.message).toContain('JWT expired at 1577836800')
    })

    test('returns invalid result when signature is not valid', async () => {
      const jwtVc = W3cV2JwtVerifiableCredential.fromCompact(`${CredoEs256DidJwkJwtVc}ey`)

      const result = await w3cV2JwtCredentialService.verifyCredential(agentContext, {
        credential: jwtVc,
      })

      expect(result).toEqual({
        isValid: false,
        validations: {
          dataModel: {
            isValid: true,
          },
          validityPeriod: {
            isValid: true,
          },
          signature: {
            isValid: false,
            error: expect.any(CredoError),
          },
          credentialStatus: {
            isValid: true,
          },
          issuerIsSigner: {
            isValid: false,
            error: expect.any(CredoError),
          },
        },
      })

      expect(result.validations.signature?.error?.message).toContain('Invalid JWS signature')
    })

    test('returns invalid result when credentialStatus is present and verifyCredentialStatus is enabled', async () => {
      const jwtVc = W3cV2JwtVerifiableCredential.fromCompact(CredoEs256DidJwkJwtVc)

      jwtVc.resolvedCredential.credentialStatus = new W3cV2CredentialStatus({
        id: 'https://example.com/status/1',
        type: 'StatusList2021Entry',
      })

      const result = await w3cV2JwtCredentialService.verifyCredential(agentContext, {
        credential: jwtVc,
        verifyCredentialStatus: true,
      })

      expect(result.isValid).toBe(false)
      expect(result.validations.credentialStatus).toMatchObject({
        isValid: false,
      })
      expect(result.validations.credentialStatus?.error?.message).toContain(
        'Verifying credential status is not supported'
      )
    })

    test('returns invalid result when credential is not yet valid based on validFrom', async () => {
      const jwtVc = W3cV2JwtVerifiableCredential.fromCompact(CredoEs256DidJwkJwtVc)

      jwtVc.resolvedCredential.validFrom = '2999-01-01T00:00:00Z'

      const result = await w3cV2JwtCredentialService.verifyCredential(agentContext, {
        credential: jwtVc,
      })

      expect(result.isValid).toBe(false)
      expect(result.validations.validityPeriod).toMatchObject({
        isValid: false,
      })
      expect(result.validations.validityPeriod?.error?.message).toContain(
        'Credential is not valid yet based on validFrom'
      )
    })

    test('logs SHOULD warning for JOSE header iss conflict with payload iss', async () => {
      const jwtVc = W3cV2JwtVerifiableCredential.fromCompact(CredoEs256DidJwkJwtVc)
      const warnSpy = vi.spyOn(agentContext.config.logger, 'warn')

      jwtVc.jwt.payload.iss = jwtVc.resolvedCredential.issuerId
      jwtVc.jwt.header.iss = 'did:example:different-header-iss'

      await w3cV2JwtCredentialService.verifyCredential(agentContext, {
        credential: jwtVc,
      })

      expect(warnSpy).toHaveBeenCalledWith('VC-JOSE-COSE SHOULD warning: JOSE header iss conflicts with payload iss', {
        format: 'vc+jwt',
        headerIss: 'did:example:different-header-iss',
        payloadIss: jwtVc.resolvedCredential.issuerId,
      })

      warnSpy.mockRestore()
    })

    test('logs SHOULD warning for jti and credential id conflict', async () => {
      const jwtVc = W3cV2JwtVerifiableCredential.fromCompact(CredoEs256DidJwkJwtVc)
      const warnSpy = vi.spyOn(agentContext.config.logger, 'warn')

      jwtVc.resolvedCredential.id = 'urn:example:credential-id'
      jwtVc.jwt.payload.jti = 'urn:example:different-jti'

      await w3cV2JwtCredentialService.verifyCredential(agentContext, {
        credential: jwtVc,
      })

      expect(warnSpy).toHaveBeenCalledWith('VC-JOSE-COSE SHOULD warning: jti claim conflicts with credential id', {
        format: 'vc+jwt',
        jti: 'urn:example:different-jti',
        credentialId: 'urn:example:credential-id',
      })

      warnSpy.mockRestore()
    })

    test('logs SHOULD warning for sub mismatch with credentialSubject.id', async () => {
      const jwtVc = W3cV2JwtVerifiableCredential.fromCompact(CredoEs256DidJwkJwtVc)
      const warnSpy = vi.spyOn(agentContext.config.logger, 'warn')

      jwtVc.jwt.payload.sub = 'did:example:not-a-subject'

      await w3cV2JwtCredentialService.verifyCredential(agentContext, {
        credential: jwtVc,
      })

      expect(warnSpy).toHaveBeenCalledWith(
        'VC-JOSE-COSE SHOULD warning: sub claim does not match any credentialSubject.id',
        {
          format: 'vc+jwt',
          sub: 'did:example:not-a-subject',
          credentialSubjectIds: jwtVc.resolvedCredential.credentialSubjectIds,
        }
      )

      warnSpy.mockRestore()
    })
  })

  describe('signPresentation', () => {
    test('signs an ES256 JWT vp', async () => {
      // Create a new instance of the credential from the serialized JWT
      const parsedJwtVc = W3cV2JwtVerifiableCredential.fromCompact(CredoEs256DidJwkJwtVc)

      const envelopedCredential = W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(parsedJwtVc)

      const presentation = new W3cV2Presentation({
        context: [CREDENTIALS_CONTEXT_V2_URL],
        type: ['VerifiablePresentation'],
        verifiableCredential: [envelopedCredential],
        id: 'urn:21ff21f1-3cf9-4fa3-88b4-a045efbb1b5f',
        holder: holderDidKey.did,
      })

      vi.spyOn(Date, 'now').mockReturnValueOnce(1698151532000)
      const signedJwtVp = await w3cV2JwtCredentialService.signPresentation(agentContext, {
        presentation,
        challenge: 'daf942ad-816f-45ee-a9fc-facd08e5abca',
        domain: 'example.com',
        format: ClaimFormat.JwtW3cVp,
      })

      expect(signedJwtVp.jwt.payload.iat).toBe(1698151532)
      expect(signedJwtVp.encoded).toEqual(CredoEs256DidKeyJwtVp)
    })

    test('signs a JWT vp with multiple enveloped credentials', async () => {
      const parsedJwtVc = W3cV2JwtVerifiableCredential.fromCompact(CredoEs256DidJwkJwtVc)

      const envelopedCredential = W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(parsedJwtVc)

      const presentation = new W3cV2Presentation({
        context: [CREDENTIALS_CONTEXT_V2_URL],
        type: ['VerifiablePresentation'],
        verifiableCredential: [envelopedCredential, envelopedCredential],
        id: 'urn:multi-jwt-vp',
        holder: holderDidKey.did,
      })

      const signedJwtVp = await w3cV2JwtCredentialService.signPresentation(agentContext, {
        presentation,
        challenge: 'daf942ad-816f-45ee-a9fc-facd08e5abca',
        domain: 'example.com',
        format: ClaimFormat.JwtW3cVp,
      })

      const decodedCredentials = Array.isArray(signedJwtVp.resolvedPresentation.verifiableCredential)
        ? signedJwtVp.resolvedPresentation.verifiableCredential
        : [signedJwtVp.resolvedPresentation.verifiableCredential]

      expect(decodedCredentials).toHaveLength(2)
    })

    test.each([
      ['adds', [CREDENTIALS_CONTEXT_V2_URL]],
      ['does not duplicate', [CREDENTIALS_CONTEXT_V2_URL, CREDENTIALS_UNDEFINED_TERMS_V2_URL]],
    ])('%s the undefined terms context in the vp payload', async (_, context) => {
      const parsedJwtVc = W3cV2JwtVerifiableCredential.fromCompact(CredoEs256DidJwkJwtVc)

      const presentation = new W3cV2Presentation({
        context,
        type: ['VerifiablePresentation'],
        verifiableCredential: [W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(parsedJwtVc)],
        holder: holderDidKey.did,
      })

      const signedJwtVp = await w3cV2JwtCredentialService.signPresentation(agentContext, {
        presentation,
        challenge: 'daf942ad-816f-45ee-a9fc-facd08e5abca',
        domain: 'example.com',
        format: ClaimFormat.JwtW3cVp,
      })

      expect(signedJwtVp.jwt.payload.additionalClaims['@context']).toEqual([
        CREDENTIALS_CONTEXT_V2_URL,
        CREDENTIALS_UNDEFINED_TERMS_V2_URL,
      ])
    })

    test('signs a holder-driven JWT vp without enclosed credentials', async () => {
      const presentation = new W3cV2Presentation({
        context: [CREDENTIALS_CONTEXT_V2_URL],
        type: ['VerifiablePresentation'],
        id: 'urn:holder-only-jwt-vp',
        holder: holderDidKey.did,
      })

      await expect(
        w3cV2JwtCredentialService.signPresentation(agentContext, {
          presentation,
          challenge: 'daf942ad-816f-45ee-a9fc-facd08e5abca',
          domain: 'example.com',
          format: ClaimFormat.JwtW3cVp,
        })
      ).resolves.toBeInstanceOf(W3cV2JwtVerifiablePresentation)
    })

    test('signs when included credentials are missing holder binding cnf', async () => {
      const credential = JsonTransformer.fromJSON(Ed256DidJwkJwtVcUnsigned, W3cV2Credential)

      const credentialWithoutCnfA = await w3cV2JwtCredentialService.signCredential(agentContext, {
        alg: KnownJwaSignatureAlgorithms.ES256,
        format: ClaimFormat.JwtW3cVc,
        verificationMethod: issuerDidJwk.verificationMethodId,
        credential,
      })

      const credentialWithoutCnfB = await w3cV2JwtCredentialService.signCredential(agentContext, {
        alg: KnownJwaSignatureAlgorithms.ES256,
        format: ClaimFormat.JwtW3cVc,
        verificationMethod: issuerDidJwk.verificationMethodId,
        credential,
      })

      const presentation = new W3cV2Presentation({
        context: [CREDENTIALS_CONTEXT_V2_URL],
        type: ['VerifiablePresentation'],
        verifiableCredential: [
          W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(credentialWithoutCnfA),
          W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(credentialWithoutCnfB),
        ],
        id: 'urn:missing-cnf-jwt-vp',
        holder: holderDidKey.did,
      })

      await expect(
        w3cV2JwtCredentialService.signPresentation(agentContext, {
          presentation,
          challenge: 'daf942ad-816f-45ee-a9fc-facd08e5abca',
          domain: 'example.com',
          format: ClaimFormat.JwtW3cVp,
        })
      ).resolves.toBeInstanceOf(W3cV2JwtVerifiablePresentation)
    })

    test('throws when included credentials use different holder binding keys', async () => {
      const credential = JsonTransformer.fromJSON(Ed256DidJwkJwtVcUnsigned, W3cV2Credential)

      const credentialForFirstHolder = await w3cV2JwtCredentialService.signCredential(agentContext, {
        alg: KnownJwaSignatureAlgorithms.ES256,
        format: ClaimFormat.JwtW3cVc,
        verificationMethod: issuerDidJwk.verificationMethodId,
        holder: {
          method: 'did',
          didUrl: `${holderDidKey.did}#${holderDidKey.publicJwk.fingerprint}`,
        },
        credential,
      })

      const credentialForSecondHolder = await w3cV2JwtCredentialService.signCredential(agentContext, {
        alg: KnownJwaSignatureAlgorithms.ES256,
        format: ClaimFormat.JwtW3cVc,
        verificationMethod: issuerDidJwk.verificationMethodId,
        holder: {
          method: 'did',
          didUrl: `${secondHolderDidKey.did}#${secondHolderDidKey.publicJwk.fingerprint}`,
        },
        credential,
      })

      const presentation = new W3cV2Presentation({
        context: [CREDENTIALS_CONTEXT_V2_URL],
        type: ['VerifiablePresentation'],
        verifiableCredential: [
          W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(credentialForFirstHolder),
          W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(credentialForSecondHolder),
        ],
        id: 'urn:mismatched-holder-jwt-vp',
        holder: holderDidKey.did,
      })

      await expect(
        w3cV2JwtCredentialService.signPresentation(agentContext, {
          presentation,
          challenge: 'daf942ad-816f-45ee-a9fc-facd08e5abca',
          domain: 'example.com',
          format: ClaimFormat.JwtW3cVp,
        })
      ).rejects.toThrow(
        `Unable to determine signer key for presentation holder '${holderDidKey.did}'. The presentation credentials are bound to more than one key.`
      )
    })
  })

  describe('verifyPresentation', () => {
    describe('holder binding', () => {
      type Party = 'holder' | 'other'

      // signCredential only writes a cnf it recognizes, so this signs the credential like it with a cnf it doesn't
      async function signWithUnrecognizedCnf(_: unknown, options: W3cV2JwtSignCredentialOptions) {
        const { publicJwk } = await dids.resolveVerificationMethodFromCreatedDidRecord(options.verificationMethod)
        const jwt = await jwsService.createJwsCompact(agentContext, {
          payload: new JwtPayload({
            iat: 1698151532,
            additionalClaims: {
              ...JsonTransformer.toJSON(options.credential),
              cnf: { jku: 'https://issuer.example/jwks.json' },
            },
          }),
          keyId: publicJwk.keyId,
          protectedHeaderOptions: { typ: 'vc+jwt', alg: options.alg, kid: options.verificationMethod },
        })
        return W3cV2JwtVerifiableCredential.fromCompact(jwt)
      }

      // signPresentation refuses a presenter the credential is not bound to, so this signs the presentation like it without those checks
      async function signPresentationWithKeyOf(presenter: DidKey | DidJwk, presentation: W3cV2Presentation) {
        const verificationMethod =
          presenter instanceof DidJwk
            ? presenter.verificationMethodId
            : `${presenter.did}#${presenter.publicJwk.fingerprint}`
        const { publicJwk } = await dids.resolveVerificationMethodFromCreatedDidRecord(verificationMethod)
        const jwt = await jwsService.createJwsCompact(agentContext, {
          payload: new JwtPayload({
            aud: 'example.com',
            additionalClaims: { ...JsonTransformer.toJSON(presentation), nonce: 'challenge' },
          }),
          keyId: publicJwk.keyId,
          protectedHeaderOptions: { typ: 'vp+jwt', alg: KnownJwaSignatureAlgorithms.EdDSA, kid: verificationMethod },
        })
        return W3cV2JwtVerifiablePresentation.fromCompact(jwt)
      }

      /**
       * Issues a credential bound to `subject` (credentialSubject.id) and/or `cnf`, and presents it
       * signed by `presenter`.
       */
      async function presentCredential(options: { subject?: Party; cnf?: Party | 'unrecognized'; presenter: Party }) {
        const parties = { holder: holderDidKey, other: secondHolderDidKey }
        const { id: _id, ...credentialSubject } = Ed256DidJwkJwtVcUnsigned.credentialSubject
        const cnfParty = options.cnf && options.cnf !== 'unrecognized' ? parties[options.cnf] : undefined

        vi.spyOn(Date, 'now').mockReturnValue(1698151532000)
        const credential = await (options.cnf === 'unrecognized'
          ? signWithUnrecognizedCnf
          : w3cV2JwtCredentialService.signCredential.bind(w3cV2JwtCredentialService))(agentContext, {
          alg: KnownJwaSignatureAlgorithms.ES256,
          format: ClaimFormat.JwtW3cVc,
          verificationMethod: issuerDidJwk.verificationMethodId,
          credential: JsonTransformer.fromJSON(
            {
              ...Ed256DidJwkJwtVcUnsigned,
              credentialSubject: options.subject
                ? { ...credentialSubject, id: parties[options.subject].did }
                : credentialSubject,
            },
            W3cV2Credential
          ),
          holder: cnfParty ? { method: 'did', didUrl: `${cnfParty.did}#${cnfParty.publicJwk.fingerprint}` } : undefined,
        })

        const unsignedPresentation = new W3cV2Presentation({
          context: [CREDENTIALS_CONTEXT_V2_URL],
          type: ['VerifiablePresentation'],
          verifiableCredential: [W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(credential)],
          holder: parties[options.presenter].did,
        })
        const presentation =
          (options.cnf && options.cnf !== options.presenter) ||
          (options.subject && options.subject !== options.presenter)
            ? await signPresentationWithKeyOf(parties[options.presenter], unsignedPresentation)
            : await w3cV2JwtCredentialService.signPresentation(agentContext, {
                presentation: unsignedPresentation,
                challenge: 'challenge',
                domain: 'example.com',
                format: ClaimFormat.JwtW3cVp,
              })
        vi.mocked(Date.now).mockRestore()

        return new W3cV2CredentialService(
          {} as never,
          {} as never,
          w3cV2JwtCredentialService,
          {} as never
        ).verifyPresentation(agentContext, {
          presentation,
          challenge: 'challenge',
          domain: 'example.com',
        })
      }

      test.each([
        ['accepts a credential without holder binding', { presenter: 'holder' }, true],
        [
          'accepts a credential bound to its subject, presented by the subject',
          { subject: 'holder', presenter: 'holder' },
          true,
        ],
        [
          'rejects a credential bound to its subject, presented by someone else',
          { subject: 'holder', presenter: 'other' },
          false,
        ],
        ['accepts a credential bound to a key, presented with that key', { cnf: 'holder', presenter: 'holder' }, true],
        [
          'rejects a credential bound to a key, presented with another key',
          { cnf: 'holder', presenter: 'other' },
          false,
        ],
        ['rejects a credential with an unrecognized cnf', { cnf: 'unrecognized', presenter: 'holder' }, false],
        [
          'accepts a credential bound to its subject and a key, presented by both',
          { subject: 'holder', cnf: 'holder', presenter: 'holder' },
          true,
        ],
        [
          'rejects a credential bound to its subject and a key, presented by the subject only',
          { subject: 'holder', cnf: 'other', presenter: 'holder' },
          false,
        ],
        [
          'rejects a credential bound to its subject and a key, presented with the key only',
          { subject: 'other', cnf: 'holder', presenter: 'holder' },
          false,
        ],
      ] as const)('%s', async (_, options, isValid) => {
        const result = await presentCredential(options)

        expect(result.presentation.isValid).toBe(true)
        expect(result.credentialEntries[0]?.isValid).toBe(isValid)
        expect(result.isValid).toBe(isValid)
      })

      async function signPresentationBoundTo(cnfDidUrls: string[], holder: string) {
        vi.spyOn(Date, 'now').mockReturnValue(1698151532000)
        try {
          const credentials = await Promise.all(
            cnfDidUrls.map((didUrl) =>
              w3cV2JwtCredentialService.signCredential(agentContext, {
                alg: KnownJwaSignatureAlgorithms.ES256,
                format: ClaimFormat.JwtW3cVc,
                verificationMethod: issuerDidJwk.verificationMethodId,
                credential: JsonTransformer.fromJSON(
                  {
                    ...Ed256DidJwkJwtVcUnsigned,
                    credentialSubject: { ...Ed256DidJwkJwtVcUnsigned.credentialSubject, id: holder },
                  },
                  W3cV2Credential
                ),
                holder: { method: 'did', didUrl },
              })
            )
          )

          return await w3cV2JwtCredentialService.signPresentation(agentContext, {
            presentation: new W3cV2Presentation({
              context: [CREDENTIALS_CONTEXT_V2_URL],
              type: ['VerifiablePresentation'],
              verifiableCredential: credentials.map((credential) =>
                W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(credential)
              ),
              holder,
            }),
            challenge: 'challenge',
            domain: 'example.com',
            format: ClaimFormat.JwtW3cVp,
          })
        } finally {
          vi.mocked(Date.now).mockRestore()
        }
      }

      test('presents with the key the credential is bound to', async () => {
        const presentation = await signPresentationBoundTo(
          [`${holderDidKey.did}#${holderDidKey.publicJwk.fingerprint}`],
          holderDidKey.did
        )

        expect(presentation.jwt.header.kid).toBe(`${holderDidKey.did}#${holderDidKey.publicJwk.fingerprint}`)

        const result = await new W3cV2CredentialService(
          {} as never,
          {} as never,
          w3cV2JwtCredentialService,
          {} as never
        ).verifyPresentation(agentContext, { presentation, challenge: 'challenge', domain: 'example.com' })

        expect(result.isValid).toBe(true)
      })

      describe('with a cnf.kid on a did:key and a did:jwk of the same key', () => {
        const didKeyUrl = () => `${holderDidKey.did}#${holderDidKey.publicJwk.fingerprint}`

        test('throws when signing as the did:jwk', async () => {
          await expect(signPresentationBoundTo([didKeyUrl()], holderDidJwk.did)).rejects.toThrow(
            `Presentation holder '${holderDidJwk.did}' is not the did '${holderDidKey.did}' of credential cnf.kid '${didKeyUrl()}'`
          )
        })

        test('rejects a presentation signed as the did:jwk', async () => {
          vi.spyOn(Date, 'now').mockReturnValue(1698151532000)
          const credential = await w3cV2JwtCredentialService.signCredential(agentContext, {
            alg: KnownJwaSignatureAlgorithms.ES256,
            format: ClaimFormat.JwtW3cVc,
            verificationMethod: issuerDidJwk.verificationMethodId,
            credential: JsonTransformer.fromJSON(
              {
                ...Ed256DidJwkJwtVcUnsigned,
                credentialSubject: { ...Ed256DidJwkJwtVcUnsigned.credentialSubject, id: holderDidJwk.did },
              },
              W3cV2Credential
            ),
            holder: { method: 'did', didUrl: didKeyUrl() },
          })
          const presentation = await signPresentationWithKeyOf(
            holderDidJwk,
            new W3cV2Presentation({
              context: [CREDENTIALS_CONTEXT_V2_URL],
              type: ['VerifiablePresentation'],
              verifiableCredential: [W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(credential)],
              holder: holderDidJwk.did,
            })
          )
          vi.mocked(Date.now).mockRestore()

          const result = await new W3cV2CredentialService(
            {} as never,
            {} as never,
            w3cV2JwtCredentialService,
            {} as never
          ).verifyPresentation(agentContext, { presentation, challenge: 'challenge', domain: 'example.com' })

          expect(result.presentation.isValid).toBe(true)
          expect(result.isValid).toBe(false)
          expect(result.credentialEntries[0]?.validations.credentialSubjectAuthentication).toEqual({ isValid: true })
          expect(result.credentialEntries[0]?.validations.holderBinding?.error?.message).toBe(
            `Credential is bound to cnf.kid '${didKeyUrl()}' of did '${holderDidKey.did}', but the presentation is signed by did '${holderDidJwk.did}'`
          )
        })

        test('signs and verifies when the holder, credentialSubject.id and cnf.kid are all the did:jwk', async () => {
          const presentation = await signPresentationBoundTo([holderDidJwk.verificationMethodId], holderDidJwk.did)

          expect(presentation.jwt.header.kid).toBe(holderDidJwk.verificationMethodId)

          const result = await new W3cV2CredentialService(
            {} as never,
            {} as never,
            w3cV2JwtCredentialService,
            {} as never
          ).verifyPresentation(agentContext, { presentation, challenge: 'challenge', domain: 'example.com' })

          expect(result.isValid).toBe(true)
        })
      })

      test('throws when the credential is bound to a key the holder does not control', async () => {
        await expect(
          signPresentationBoundTo([`${holderDidKey.did}#${holderDidKey.publicJwk.fingerprint}`], secondHolderDidKey.did)
        ).rejects.toThrow(
          `Unable to determine signer key for presentation holder '${secondHolderDidKey.did}'. The presentation credentials are bound to a key that is not a locally controlled authentication verification method of the holder.`
        )
      })

      test.each([
        ['with', true],
        ['without', false],
      ])(
        'throws when the credential is bound to a key the holder rotated out of its did document, %s a holder',
        async (_, withHolder) => {
          const party = withHolder ? 'holder' : 'signer'
          const holderDid = 'did:web:rotated-holder.example'
          const importHolderDidWithKey = async (keyId: string) => {
            const key = await kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
            const verificationMethod = new VerificationMethod(
              getJsonWebKey2020({
                did: holderDid,
                verificationMethodId: `${holderDid}#${keyId}`,
                publicJwk: PublicJwk.fromPublicJwk(key.publicJwk),
              })
            )
            await dids.import({
              did: holderDid,
              didDocument: new DidDocument({
                id: holderDid,
                verificationMethod: [verificationMethod],
                authentication: [verificationMethod.id],
              }),
              keys: [{ didDocumentRelativeKeyId: `#${keyId}`, kmsKeyId: key.keyId }],
              overwrite: true,
            })
          }

          await importHolderDidWithKey('key-1')
          vi.spyOn(Date, 'now').mockReturnValue(1698151532000)
          try {
            const credential = await w3cV2JwtCredentialService.signCredential(agentContext, {
              alg: KnownJwaSignatureAlgorithms.ES256,
              format: ClaimFormat.JwtW3cVc,
              verificationMethod: issuerDidJwk.verificationMethodId,
              credential: JsonTransformer.fromJSON(
                {
                  ...Ed256DidJwkJwtVcUnsigned,
                  credentialSubject: { ...Ed256DidJwkJwtVcUnsigned.credentialSubject, id: holderDid },
                },
                W3cV2Credential
              ),
              holder: { method: 'did', didUrl: `${holderDid}#key-1` },
            })
            await importHolderDidWithKey('key-2')

            const error = await w3cV2JwtCredentialService
              .signPresentation(agentContext, {
                presentation: new W3cV2Presentation({
                  context: [CREDENTIALS_CONTEXT_V2_URL],
                  type: ['VerifiablePresentation'],
                  verifiableCredential: [W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(credential)],
                  holder: withHolder ? holderDid : undefined,
                }),
                challenge: 'challenge',
                domain: 'example.com',
                format: ClaimFormat.JwtW3cVp,
              })
              .catch((error) => error)

            expect(error).toBeInstanceOf(CredoError)
            expect(error.message).toBe(
              `Unable to determine signer key for presentation ${party} '${holderDid}'. The presentation credentials are bound to a key that is not a locally controlled authentication verification method of the ${party}.`
            )
            expect(error.cause?.message).toContain(`Unable to locate verification method with id '${holderDid}#key-1'`)
          } finally {
            vi.mocked(Date.now).mockRestore()
          }
        }
      )

      describe('signer resolution', () => {
        type SignerCase = {
          holder?: string
          credentials: Array<{ subjectIds?: string[]; cnf?: W3cV2JwtSignCredentialOptions['holder'] }>
        }

        const didBinding = (didKey: DidKey) => ({
          method: 'did' as const,
          didUrl: `${didKey.did}#${didKey.publicJwk.fingerprint}`,
        })

        async function signPresentationFor({ holder, credentials }: SignerCase) {
          const { id: _id, ...credentialSubject } = Ed256DidJwkJwtVcUnsigned.credentialSubject
          vi.spyOn(Date, 'now').mockReturnValue(1698151532000)
          try {
            const signedCredentials = await Promise.all(
              credentials.map(({ subjectIds = [], cnf }) =>
                w3cV2JwtCredentialService.signCredential(agentContext, {
                  alg: KnownJwaSignatureAlgorithms.ES256,
                  format: ClaimFormat.JwtW3cVc,
                  verificationMethod: issuerDidJwk.verificationMethodId,
                  credential: JsonTransformer.fromJSON(
                    {
                      ...Ed256DidJwkJwtVcUnsigned,
                      credentialSubject:
                        subjectIds.length > 0
                          ? subjectIds.map((id) => ({ ...credentialSubject, id }))
                          : credentialSubject,
                    },
                    W3cV2Credential
                  ),
                  holder: cnf,
                })
              )
            )

            return await w3cV2JwtCredentialService.signPresentation(agentContext, {
              presentation: new W3cV2Presentation({
                context: [CREDENTIALS_CONTEXT_V2_URL],
                type: ['VerifiablePresentation'],
                verifiableCredential: signedCredentials.map((credential) =>
                  W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(credential)
                ),
                holder,
              }),
              challenge: 'challenge',
              domain: 'example.com',
              format: ClaimFormat.JwtW3cVp,
            })
          } finally {
            vi.mocked(Date.now).mockRestore()
          }
        }

        test.each<[string, () => SignerCase]>([
          [
            'the holder',
            () => ({
              holder: holderDidKey.did,
              credentials: [{ subjectIds: [holderDidKey.did], cnf: didBinding(holderDidKey) }],
            }),
          ],
          [
            'the credentialSubject.id the credentials share',
            () => ({ credentials: [{ subjectIds: [holderDidKey.did] }, { subjectIds: [holderDidKey.did] }] }),
          ],
          ['the DID of the cnf.kid', () => ({ credentials: [{ cnf: didBinding(holderDidKey) }] })],
          [
            'the credentialSubject.id the cnf.kid selects',
            () => ({
              credentials: [{ subjectIds: [holderDidKey.did, secondHolderDidKey.did], cnf: didBinding(holderDidKey) }],
            }),
          ],
          [
            'the credentialSubject.id of a credential bound with cnf.jwk',
            () => ({
              credentials: [{ subjectIds: [holderDidKey.did], cnf: { method: 'jwk', jwk: holderDidKey.publicJwk } }],
            }),
          ],
        ])('signs as %s, and the verifier accepts it', async (_, getSignerCase) => {
          const presentation = await signPresentationFor(getSignerCase())

          expect(presentation.jwt.header.kid).toBe(`${holderDidKey.did}#${holderDidKey.publicJwk.fingerprint}`)

          const result = await new W3cV2CredentialService(
            {} as never,
            {} as never,
            w3cV2JwtCredentialService,
            {} as never
          ).verifyPresentation(agentContext, { presentation, challenge: 'challenge', domain: 'example.com' })

          expect(result.isValid).toBe(true)
        })

        test.each<[string, () => SignerCase & { error: string }]>([
          [
            'the holder is not a credentialSubject.id',
            () => ({
              holder: holderDidKey.did,
              credentials: [{ subjectIds: [secondHolderDidKey.did] }],
              error: `Presentation holder '${holderDidKey.did}' is not a credentialSubject.id of every presentation credential that has one`,
            }),
          ],
          [
            'the holder is not a credentialSubject.id of every credential',
            () => ({
              holder: holderDidKey.did,
              credentials: [{ subjectIds: [holderDidKey.did] }, { subjectIds: [secondHolderDidKey.did] }],
              error: `Presentation holder '${holderDidKey.did}' is not a credentialSubject.id of every presentation credential that has one`,
            }),
          ],
          [
            'the credentialSubject.id does not control the cnf key, without a holder',
            () => ({
              credentials: [{ subjectIds: [secondHolderDidKey.did], cnf: didBinding(holderDidKey) }],
              error: `Unable to determine signer key for presentation signer '${secondHolderDidKey.did}'. The presentation credentials are bound to a key that is not a locally controlled authentication verification method of the signer.`,
            }),
          ],
          [
            'the credentials share no credentialSubject.id, without a holder',
            () => ({
              credentials: [{ subjectIds: [holderDidKey.did] }, { subjectIds: [secondHolderDidKey.did] }],
              error:
                'Unable to determine signer from presentation credentials, and presentation.holder is missing. The credentials do not share a credentialSubject.id.',
            }),
          ],
          [
            'the credentials share several credentialSubject.ids and no cnf.kid selects one, without a holder',
            () => ({
              credentials: [{ subjectIds: [holderDidKey.did, secondHolderDidKey.did] }],
              error:
                'Unable to determine signer from presentation credentials, and presentation.holder is missing. The credentials share more than one credentialSubject.id, and their cnf does not select one.',
            }),
          ],
          [
            'the credentialSubject.id is not a did, without a holder',
            () => ({
              credentials: [
                { subjectIds: ['urn:uuid:5fe1ab5c-1f45-4ba3-9a83-f4c4d9a3d9c4'], cnf: didBinding(holderDidKey) },
              ],
              error: "Presentation signer 'urn:uuid:5fe1ab5c-1f45-4ba3-9a83-f4c4d9a3d9c4' is not a valid did",
            }),
          ],
          [
            'the credentialSubject.id is not a did this agent created, without a holder',
            () => ({
              credentials: [{ subjectIds: ['did:example:B'], cnf: didBinding(holderDidKey) }],
              error: "Presentation signer 'did:example:B' is not a did created by this agent",
            }),
          ],
          [
            'the cnf.kid is on another did with the same key',
            () => ({
              holder: holderDidJwk.did,
              credentials: [{ subjectIds: [holderDidJwk.did], cnf: didBinding(holderDidKey) }],
              error: `Presentation holder '${holderDidJwk.did}' is not the did '${holderDidKey.did}' of credential cnf.kid '${holderDidKey.did}#${holderDidKey.publicJwk.fingerprint}'`,
            }),
          ],
          [
            'the cnf.kid is on another did with the same key, without a holder',
            () => ({
              credentials: [
                { subjectIds: [holderDidKey.did], cnf: { method: 'did', didUrl: holderDidJwk.verificationMethodId } },
              ],
              error: `Presentation signer '${holderDidKey.did}' is not the did '${holderDidJwk.did}' of credential cnf.kid '${holderDidJwk.verificationMethodId}'`,
            }),
          ],
          [
            'the credentials are only bound with cnf.jwk, without a holder',
            () => ({
              credentials: [{ cnf: { method: 'jwk', jwk: holderDidKey.publicJwk } }],
              error: 'Unable to determine signer from presentation credentials, and presentation.holder is missing',
            }),
          ],
          [
            'the credentials are bound to different dids, without a holder',
            () => ({
              credentials: [{ cnf: didBinding(holderDidKey) }, { cnf: didBinding(secondHolderDidKey) }],
              error:
                'Unable to determine signer from presentation credentials. Multiple distinct holder bindings found and presentation.holder is missing.',
            }),
          ],
        ])('throws when %s', async (_, getSignerCase) => {
          const { error, ...signerCase } = getSignerCase()

          await expect(signPresentationFor(signerCase)).rejects.toThrow(error)
        })

        test('signs with the legacy key id for a holder did record without keys', async () => {
          const { privateJwk } = transformSeedToPrivateJwk({
            type: { kty: 'OKP', crv: 'Ed25519' },
            seed: TypedArrayEncoder.fromUtf8String('legacy-holder-seed-0000000000000'),
          })
          const legacyDidKey = new DidKey(PublicJwk.fromUnknown(publicJwkFromPrivateJwk(privateJwk)))
          await kms.importKey({ privateJwk: { ...privateJwk, kid: legacyDidKey.publicJwk.legacyKeyId } })
          await agentContext.resolve(DidRepository).storeCreatedDid(agentContext, { did: legacyDidKey.did })

          const presentation = await signPresentationFor({
            holder: legacyDidKey.did,
            credentials: [{ subjectIds: [legacyDidKey.did] }],
          })

          expect(presentation.jwt.header.kid).toBe(`${legacyDidKey.did}#${legacyDidKey.publicJwk.fingerprint}`)

          const result = await new W3cV2CredentialService(
            {} as never,
            {} as never,
            w3cV2JwtCredentialService,
            {} as never
          ).verifyPresentation(agentContext, { presentation, challenge: 'challenge', domain: 'example.com' })

          expect(result.isValid).toBe(true)
        })

        test('throws when the cnf.kid is not an authentication method, without a holder', async () => {
          const did = 'did:web:assertion-key-holder.example'
          const [authenticationKey, assertionKey] = await Promise.all([
            kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } }),
            kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } }),
          ])
          const verificationMethods = [authenticationKey, assertionKey].map(
            (key, index) =>
              new VerificationMethod(
                getJsonWebKey2020({
                  did,
                  verificationMethodId: `${did}#key-${index + 1}`,
                  publicJwk: PublicJwk.fromPublicJwk(key.publicJwk),
                })
              )
          )
          const importDid = (authentication: string[]) =>
            dids.import({
              did,
              didDocument: new DidDocument({
                id: did,
                verificationMethod: verificationMethods,
                authentication,
                assertionMethod: [`${did}#key-2`],
              }),
              keys: [
                { didDocumentRelativeKeyId: '#key-1', kmsKeyId: authenticationKey.keyId },
                { didDocumentRelativeKeyId: '#key-2', kmsKeyId: assertionKey.keyId },
              ],
              overwrite: true,
            })

          // signCredential only binds to an authentication method
          await importDid([`${did}#key-1`, `${did}#key-2`])
          vi.spyOn(Date, 'now').mockReturnValue(1698151532000)
          const credential = await w3cV2JwtCredentialService
            .signCredential(agentContext, {
              alg: KnownJwaSignatureAlgorithms.ES256,
              format: ClaimFormat.JwtW3cVc,
              verificationMethod: issuerDidJwk.verificationMethodId,
              credential: JsonTransformer.fromJSON(
                {
                  ...Ed256DidJwkJwtVcUnsigned,
                  credentialSubject: { ...Ed256DidJwkJwtVcUnsigned.credentialSubject, id: did },
                },
                W3cV2Credential
              ),
              holder: { method: 'did', didUrl: `${did}#key-2` },
            })
            .finally(() => vi.mocked(Date.now).mockRestore())
          await importDid([`${did}#key-1`])

          const error = await w3cV2JwtCredentialService
            .signPresentation(agentContext, {
              presentation: new W3cV2Presentation({
                context: [CREDENTIALS_CONTEXT_V2_URL],
                type: ['VerifiablePresentation'],
                verifiableCredential: [W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(credential)],
              }),
              challenge: 'challenge',
              domain: 'example.com',
              format: ClaimFormat.JwtW3cVp,
            })
            .catch((error) => error)

          expect(error.message).toBe(
            `Unable to determine signer key for presentation signer '${did}'. The presentation credentials are bound to a key that is not a locally controlled authentication verification method of the signer.`
          )
          expect(error.cause?.message).toContain(
            `Unable to locate verification method with id '${did}#key-2' in purposes authentication`
          )
        })
      })
    })

    test('rejects a presentation without holder signed with a key that names the holder as its controller', async () => {
      const signerDid = 'did:web:signer.example'
      const signerKey = await kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
      const verificationMethod = new VerificationMethod({
        ...getJsonWebKey2020({
          did: signerDid,
          verificationMethodId: `${signerDid}#key-1`,
          publicJwk: PublicJwk.fromPublicJwk(signerKey.publicJwk),
        }),
        controller: holderDidKey.did,
      })
      await dids.import({
        did: signerDid,
        didDocument: new DidDocument({
          id: signerDid,
          verificationMethod: [verificationMethod],
          authentication: [verificationMethod.id],
        }),
      })

      // No holder and no iss, so the presentation is attributed to the signer of its kid
      const presentation = new W3cV2Presentation({
        context: [CREDENTIALS_CONTEXT_V2_URL],
        type: ['VerifiablePresentation'],
        verifiableCredential: [
          W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(
            W3cV2JwtVerifiableCredential.fromCompact(CredoEs256DidJwkJwtVc)
          ),
        ],
      })
      const payload = new JwtPayload({ aud: 'example.com', additionalClaims: JsonTransformer.toJSON(presentation) })
      payload.additionalClaims.nonce = 'challenge'
      const jwt = await jwsService.createJwsCompact(agentContext, {
        payload,
        keyId: signerKey.keyId,
        protectedHeaderOptions: { typ: 'vp+jwt', alg: KnownJwaSignatureAlgorithms.EdDSA, kid: verificationMethod.id },
      })

      const w3cV2CredentialService = new W3cV2CredentialService(
        {} as never,
        {} as never,
        w3cV2JwtCredentialService,
        {} as never
      )
      const result = await w3cV2CredentialService.verifyPresentation(agentContext, {
        presentation: W3cV2JwtVerifiablePresentation.fromCompact(jwt),
        challenge: 'challenge',
        domain: 'example.com',
      })

      expect(result.isValid).toBe(false)
      expect(result.error?.message).toContain(
        `Verification method '${verificationMethod.id}' is controlled by '${holderDidKey.did}', not by the DID document '${signerDid}' it is listed in`
      )
    })

    test('verifies an ES256 JWT vp signed by Credo', async () => {
      const result = await w3cV2JwtCredentialService.verifyPresentation(agentContext, {
        presentation: CredoEs256DidKeyJwtVp,
        challenge: 'daf942ad-816f-45ee-a9fc-facd08e5abca',
        domain: 'example.com',
      })

      expect(result).toEqual({
        isValid: true,
        presentation: {
          isValid: true,
          validations: {
            dataModel: {
              isValid: true,
            },
            presentationSignature: {
              isValid: true,
            },
            holderIsSigner: {
              isValid: true,
            },
          },
        },
        credentialEntries: [],
      })
    })

    test('logs SHOULD warning for presentation jti and id conflict', async () => {
      const jwtVp = W3cV2JwtVerifiablePresentation.fromCompact(CredoEs256DidKeyJwtVp)
      const warnSpy = vi.spyOn(agentContext.config.logger, 'warn')

      jwtVp.resolvedPresentation.id = 'urn:example:vp-id'
      jwtVp.jwt.payload.jti = 'urn:example:different-vp-jti'

      await w3cV2JwtCredentialService.verifyPresentation(agentContext, {
        presentation: jwtVp,
        challenge: 'daf942ad-816f-45ee-a9fc-facd08e5abca',
        domain: 'example.com',
      })

      expect(warnSpy).toHaveBeenCalledWith('VC-JOSE-COSE SHOULD warning: jti claim conflicts with presentation id', {
        format: 'vp+jwt',
        jti: 'urn:example:different-vp-jti',
        presentationId: 'urn:example:vp-id',
      })

      warnSpy.mockRestore()
    })
  })
})
