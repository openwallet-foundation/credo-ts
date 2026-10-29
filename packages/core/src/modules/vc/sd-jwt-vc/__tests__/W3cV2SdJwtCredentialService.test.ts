import { NativeAskar } from '@openwallet-foundation/askar-nodejs'
import { SDJwtInstance } from '@sd-jwt/core'
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
import { Hasher, JwsService, JwtPayload } from '../../../../crypto'
import { ClassValidationError, CredoError } from '../../../../error'
import { JsonTransformer, TypedArrayEncoder } from '../../../../utils'
import { CacheModuleConfig, InMemoryLruCache } from '../../../cache'
import { DidJwk, DidKey, DidRepository, DidsApi, DidsModuleConfig } from '../../../dids'
import { KeyManagementApi, KnownJwaSignatureAlgorithms, PublicJwk } from '../../../kms'
import { getSdJwtSigner } from '../../../sd-jwt-vc/utils'
import { X509ModuleConfig } from '../../../x509/X509ModuleConfig'
import { CREDENTIALS_CONTEXT_V2_URL } from '../../constants'
import {
  ClaimFormat,
  W3cV2Credential,
  W3cV2CredentialStatus,
  W3cV2EnvelopedVerifiableCredential,
  W3cV2Presentation,
} from '../../models'
import { W3cV2CredentialService } from '../../W3cV2CredentialService'
import type { W3cV2SdJwtSignCredentialOptions } from '../../W3cV2CredentialServiceOptions'
import { sdJwtVcHasher } from '../W3cV2SdJwt'
import { W3cV2SdJwtCredentialService } from '../W3cV2SdJwtCredentialService'
import { W3cV2SdJwtVerifiableCredential } from '../W3cV2SdJwtVerifiableCredential'
import { W3cV2SdJwtVerifiablePresentation } from '../W3cV2SdJwtVerifiablePresentation'
import {
  CredoEs256DidJwkJwtVc,
  CredoEs256DidJwkJwtVcIssuerSeed,
  CredoEs256DidJwkJwtVcSubjectSeed,
  CredoEs256DidKeyJwtVp,
  Ed256DidJwkJwtVcUnsigned,
} from './fixtures/credo-sd-jwt-vc'

// biome-ignore lint/suspicious/noExplicitAny: no explanation
const storageService = new InMemoryStorageService<any>()
const config = getAgentConfig('W3cV2SdJwtCredentialService')
const askarModuleConfig = new AskarModuleConfig({
  askar: NativeAskar,
  store: getAskarStoreConfig('W3cV2SdJwtCredentialService'),
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
const dids = agentContext.dependencyManager.resolve(DidsApi)
const w3cV2JwtCredentialService = new W3cV2SdJwtCredentialService()

kms.randomBytes = vi.fn(function () {
  return TypedArrayEncoder.fromUtf8String('salt')
})
Date.prototype.getTime = vi.fn(function () {
  return 1698151532000
})

describe('W3cV2SdJwtCredentialService', () => {
  let issuerDidJwk: DidJwk
  let holderDidKey: DidKey
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
        format: ClaimFormat.SdJwtW3cVc,
        verificationMethod: issuerDidJwk.verificationMethodId,
        credential,
        holder: {
          method: 'did',
          didUrl: `${holderDidKey.did}#${holderDidKey.publicJwk.fingerprint}`,
        },
        disclosureFrame: {
          credentialSubject: {
            _sd: ['achievement'],
          },
        },
      })

      expect(vcJwt.encoded).toEqual(CredoEs256DidJwkJwtVc)
      expect(vcJwt.sdJwt.payload.credentialSubject).toStrictEqual({
        _sd: ['gDFW86HcMH2qKkzAfqLC8-dZ2oV9AEZPVCmu6P4q8cc'],
        id: 'did:key:z6MkqgkLrRyLg6bqk27djwbbaQWgaSYgFVCKq9YKxZbNkpVv',
        type: ['AchievementSubject'],
      })
      expect((vcJwt.resolvedCredential.credentialSubject as Record<string, unknown>).achievement).toStrictEqual(
        Ed256DidJwkJwtVcUnsigned.credentialSubject.achievement
      )
    })

    test.each([
      ['in a top level _sd', { _sd: ['cnf'] }],
      ['in its own frame', { cnf: { _sd: ['kid'] } }],
    ])('throws when cnf is made selectively disclosable %s', async (_, disclosureFrame) => {
      await expect(
        w3cV2JwtCredentialService.signCredential(agentContext, {
          alg: KnownJwaSignatureAlgorithms.ES256,
          format: ClaimFormat.SdJwtW3cVc,
          verificationMethod: issuerDidJwk.verificationMethodId,
          credential: JsonTransformer.fromJSON(Ed256DidJwkJwtVcUnsigned, W3cV2Credential),
          holder: { method: 'did', didUrl: `${holderDidKey.did}#${holderDidKey.publicJwk.fingerprint}` },
          disclosureFrame,
        })
      ).rejects.toThrow("'cnf' property cannot be selectively disclosed")
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
          format: ClaimFormat.SdJwtW3cVc,
        })
      ).rejects.toThrow('Only did identifiers are supported as verification method')

      // Does not allow vc property
      await expect(
        w3cV2JwtCredentialService.signCredential(agentContext, {
          verificationMethod: 'hello',
          alg: KnownJwaSignatureAlgorithms.ES256,
          credential: JsonTransformer.fromJSON({ ...credentialJson, vc: 'test' }, W3cV2Credential, { validate: false }),
          format: ClaimFormat.SdJwtW3cVc,
        })
      ).rejects.toThrow(/property vc has failed the following constraints: vc is forbidden/)

      // Does not allow vp property
      await expect(
        w3cV2JwtCredentialService.signCredential(agentContext, {
          verificationMethod: 'hello',
          alg: KnownJwaSignatureAlgorithms.ES256,
          credential: JsonTransformer.fromJSON({ ...credentialJson, vp: 'test' }, W3cV2Credential, { validate: false }),
          format: ClaimFormat.SdJwtW3cVc,
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
          format: ClaimFormat.SdJwtW3cVc,
        })
      ).rejects.toThrow('property validFrom has failed the following constraints: validFrom must be RFC 3339 date')

      // Throw when verificationMethod id does not exist in did document
      await expect(
        w3cV2JwtCredentialService.signCredential(agentContext, {
          verificationMethod: `${issuerDidJwk.verificationMethodId}extra`,
          alg: KnownJwaSignatureAlgorithms.ES256,
          credential: JsonTransformer.fromJSON(credentialJson, W3cV2Credential),
          format: ClaimFormat.SdJwtW3cVc,
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
      const jwtVc = W3cV2SdJwtVerifiableCredential.fromCompact(CredoEs256DidJwkJwtVc)

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
      const jwtVc = W3cV2SdJwtVerifiableCredential.fromCompact(CredoEs256DidJwkJwtVc)

      // @ts-expect-error
      jwtVc.resolvedCredential.vc = 'mamma mia'

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
      const jwtVc = W3cV2SdJwtVerifiableCredential.fromCompact(CredoEs256DidJwkJwtVc)

      jwtVc.sdJwt.payload.exp = 1577836800

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

    test('returns invalid result when credentialStatus is present and verifyCredentialStatus is enabled', async () => {
      const jwtVc = W3cV2SdJwtVerifiableCredential.fromCompact(CredoEs256DidJwkJwtVc)

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
      const jwtVc = W3cV2SdJwtVerifiableCredential.fromCompact(CredoEs256DidJwkJwtVc)

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
      const jwtVc = W3cV2SdJwtVerifiableCredential.fromCompact(CredoEs256DidJwkJwtVc)
      const warnSpy = vi.spyOn(agentContext.config.logger, 'warn')

      jwtVc.sdJwt.prettyClaims.iss = jwtVc.resolvedCredential.issuerId
      jwtVc.sdJwt.header.iss = 'did:example:different-header-iss'

      await w3cV2JwtCredentialService.verifyCredential(agentContext, {
        credential: jwtVc,
      })

      expect(warnSpy).toHaveBeenCalledWith('VC-JOSE-COSE SHOULD warning: JOSE header iss conflicts with payload iss', {
        format: 'vc+sd-jwt',
        headerIss: 'did:example:different-header-iss',
        payloadIss: jwtVc.resolvedCredential.issuerId,
      })

      warnSpy.mockRestore()
    })

    test('logs SHOULD warning for jti and credential id conflict', async () => {
      const jwtVc = W3cV2SdJwtVerifiableCredential.fromCompact(CredoEs256DidJwkJwtVc)
      const warnSpy = vi.spyOn(agentContext.config.logger, 'warn')

      jwtVc.resolvedCredential.id = 'urn:example:credential-id'
      jwtVc.sdJwt.prettyClaims.jti = 'urn:example:different-jti'

      await w3cV2JwtCredentialService.verifyCredential(agentContext, {
        credential: jwtVc,
      })

      expect(warnSpy).toHaveBeenCalledWith('VC-JOSE-COSE SHOULD warning: jti claim conflicts with credential id', {
        format: 'vc+sd-jwt',
        jti: 'urn:example:different-jti',
        credentialId: 'urn:example:credential-id',
      })

      warnSpy.mockRestore()
    })

    test('logs SHOULD warning for sub mismatch with credentialSubject.id', async () => {
      const jwtVc = W3cV2SdJwtVerifiableCredential.fromCompact(CredoEs256DidJwkJwtVc)
      const warnSpy = vi.spyOn(agentContext.config.logger, 'warn')

      jwtVc.sdJwt.prettyClaims.sub = 'did:example:not-a-subject'

      await w3cV2JwtCredentialService.verifyCredential(agentContext, {
        credential: jwtVc,
      })

      expect(warnSpy).toHaveBeenCalledWith(
        'VC-JOSE-COSE SHOULD warning: sub claim does not match any credentialSubject.id',
        {
          format: 'vc+sd-jwt',
          sub: 'did:example:not-a-subject',
          credentialSubjectIds: jwtVc.resolvedCredential.credentialSubjectIds,
        }
      )

      warnSpy.mockRestore()
    })
  })

  describe('verifyCredential with getTrustedIssuersForVerification', () => {
    afterEach(() => {
      agentContext.config.setTrustedIssuersForVerification(undefined)
    })

    test('accepts a credential whose issuer did is trusted', async () => {
      const credential = W3cV2SdJwtVerifiableCredential.fromCompact(CredoEs256DidJwkJwtVc)
      agentContext.config.setTrustedIssuersForVerification(async () => ({
        trustedIssuers: [{ method: 'did', issuance: credential.resolvedCredential.issuerId }],
      }))

      const result = await w3cV2JwtCredentialService.verifyCredential(agentContext, { credential })

      expect(result.isValid).toBe(true)
    })

    test('rejects a credential whose issuer did is not trusted', async () => {
      agentContext.config.setTrustedIssuersForVerification(async () => ({
        trustedIssuers: [
          { method: 'did', issuance: 'did:key:zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y' },
        ],
      }))

      const result = await w3cV2JwtCredentialService.verifyCredential(agentContext, {
        credential: CredoEs256DidJwkJwtVc,
      })

      expect(result.isValid).toBe(false)
      expect(result.error?.message).toContain('is not trusted')
    })
  })

  describe('signPresentation', () => {
    test('signs an ES256 JWT vp', async () => {
      // Create a new instance of the credential from the serialized JWT
      const parsedJwtVc = W3cV2SdJwtVerifiableCredential.fromCompact(CredoEs256DidJwkJwtVc)

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
        format: ClaimFormat.SdJwtW3cVp,
      })

      expect(signedJwtVp.sdJwt.payload.iat).toBe(1698151532)
      expect(signedJwtVp.encoded).toEqual(CredoEs256DidKeyJwtVp)
    })

    test('signs an SD-JWT vp with multiple enveloped credentials', async () => {
      const parsedSdJwtVc = W3cV2SdJwtVerifiableCredential.fromCompact(CredoEs256DidJwkJwtVc)

      const envelopedCredential = W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(parsedSdJwtVc)

      const presentation = new W3cV2Presentation({
        context: [CREDENTIALS_CONTEXT_V2_URL],
        type: ['VerifiablePresentation'],
        verifiableCredential: [envelopedCredential, envelopedCredential],
        id: 'urn:multi-sd-jwt-vp',
        holder: holderDidKey.did,
      })

      const signedJwtVp = await w3cV2JwtCredentialService.signPresentation(agentContext, {
        presentation,
        challenge: 'daf942ad-816f-45ee-a9fc-facd08e5abca',
        domain: 'example.com',
        format: ClaimFormat.SdJwtW3cVp,
      })

      const decodedCredentials = Array.isArray(signedJwtVp.resolvedPresentation.verifiableCredential)
        ? signedJwtVp.resolvedPresentation.verifiableCredential
        : [signedJwtVp.resolvedPresentation.verifiableCredential]

      expect(decodedCredentials).toHaveLength(2)
    })

    test('signs a holder-driven SD-JWT vp without enclosed credentials', async () => {
      const presentation = new W3cV2Presentation({
        context: [CREDENTIALS_CONTEXT_V2_URL],
        type: ['VerifiablePresentation'],
        id: 'urn:holder-only-sd-jwt-vp',
        holder: holderDidKey.did,
      })

      await expect(
        w3cV2JwtCredentialService.signPresentation(agentContext, {
          presentation,
          challenge: 'daf942ad-816f-45ee-a9fc-facd08e5abca',
          domain: 'example.com',
          format: ClaimFormat.SdJwtW3cVp,
        })
      ).resolves.toBeInstanceOf(W3cV2SdJwtVerifiablePresentation)
    })

    test('signs when included credentials are missing holder binding cnf', async () => {
      const credential = JsonTransformer.fromJSON(Ed256DidJwkJwtVcUnsigned, W3cV2Credential)

      const credentialWithoutCnfA = await w3cV2JwtCredentialService.signCredential(agentContext, {
        alg: KnownJwaSignatureAlgorithms.ES256,
        format: ClaimFormat.SdJwtW3cVc,
        verificationMethod: issuerDidJwk.verificationMethodId,
        credential,
        disclosureFrame: {
          credentialSubject: {
            _sd: ['achievement'],
          },
        },
      })

      const credentialWithoutCnfB = await w3cV2JwtCredentialService.signCredential(agentContext, {
        alg: KnownJwaSignatureAlgorithms.ES256,
        format: ClaimFormat.SdJwtW3cVc,
        verificationMethod: issuerDidJwk.verificationMethodId,
        credential,
        disclosureFrame: {
          credentialSubject: {
            _sd: ['achievement'],
          },
        },
      })

      const presentation = new W3cV2Presentation({
        context: [CREDENTIALS_CONTEXT_V2_URL],
        type: ['VerifiablePresentation'],
        verifiableCredential: [
          W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(credentialWithoutCnfA),
          W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(credentialWithoutCnfB),
        ],
        id: 'urn:missing-cnf-sd-jwt-vp',
        holder: holderDidKey.did,
      })

      await expect(
        w3cV2JwtCredentialService.signPresentation(agentContext, {
          presentation,
          challenge: 'daf942ad-816f-45ee-a9fc-facd08e5abca',
          domain: 'example.com',
          format: ClaimFormat.SdJwtW3cVp,
        })
      ).resolves.toBeInstanceOf(W3cV2SdJwtVerifiablePresentation)
    })

    test('signs when included credentials use different holder binding keys', async () => {
      const credential = JsonTransformer.fromJSON(Ed256DidJwkJwtVcUnsigned, W3cV2Credential)

      const credentialForFirstHolder = await w3cV2JwtCredentialService.signCredential(agentContext, {
        alg: KnownJwaSignatureAlgorithms.ES256,
        format: ClaimFormat.SdJwtW3cVc,
        verificationMethod: issuerDidJwk.verificationMethodId,
        credential,
        holder: {
          method: 'did',
          didUrl: `${holderDidKey.did}#${holderDidKey.publicJwk.fingerprint}`,
        },
        disclosureFrame: {
          credentialSubject: {
            _sd: ['achievement'],
          },
        },
      })

      const credentialForSecondHolder = await w3cV2JwtCredentialService.signCredential(agentContext, {
        alg: KnownJwaSignatureAlgorithms.ES256,
        format: ClaimFormat.SdJwtW3cVc,
        verificationMethod: issuerDidJwk.verificationMethodId,
        credential,
        holder: {
          method: 'did',
          didUrl: `${secondHolderDidKey.did}#${secondHolderDidKey.publicJwk.fingerprint}`,
        },
        disclosureFrame: {
          credentialSubject: {
            _sd: ['achievement'],
          },
        },
      })

      const presentation = new W3cV2Presentation({
        context: [CREDENTIALS_CONTEXT_V2_URL],
        type: ['VerifiablePresentation'],
        verifiableCredential: [
          W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(credentialForFirstHolder),
          W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(credentialForSecondHolder),
        ],
        id: 'urn:mismatched-holder-sd-jwt-vp',
        holder: holderDidKey.did,
      })

      await expect(
        w3cV2JwtCredentialService.signPresentation(agentContext, {
          presentation,
          challenge: 'daf942ad-816f-45ee-a9fc-facd08e5abca',
          domain: 'example.com',
          format: ClaimFormat.SdJwtW3cVp,
        })
      ).resolves.toBeInstanceOf(W3cV2SdJwtVerifiablePresentation)
    })
  })

  describe('applyDisclosuresForPaths', () => {
    test('discloses only the claims at the paths', () => {
      const withAchievement = w3cV2JwtCredentialService.applyDisclosuresForPaths(CredoEs256DidJwkJwtVc, [
        ['credentialSubject', 'achievement'],
      ])
      expect(
        (withAchievement.resolvedCredential.credentialSubject as Record<string, unknown>).achievement
      ).toStrictEqual(Ed256DidJwkJwtVcUnsigned.credentialSubject.achievement)

      const withoutAchievement = w3cV2JwtCredentialService.applyDisclosuresForPaths(CredoEs256DidJwkJwtVc, [])
      expect(withoutAchievement.resolvedCredential.credentialSubject).not.toHaveProperty('achievement')
      // Only the issuer-signed JWT, without disclosures
      expect(withoutAchievement.encoded.split('~').filter(Boolean)).toHaveLength(1)
    })
  })

  describe('verifyPresentation', () => {
    describe('holder binding', () => {
      type Party = 'holder' | 'other'

      // signCredential only writes a cnf it recognizes, so this signs the credential like it with a cnf it doesn't
      async function signWithUnrecognizedCnf(_: unknown, options: W3cV2SdJwtSignCredentialOptions) {
        const { publicJwk } = await dids.resolveVerificationMethodFromCreatedDidRecord(options.verificationMethod)
        publicJwk.alg = options.alg
        const compact = await new SDJwtInstance({
          hasher: sdJwtVcHasher,
          saltGenerator: () => 'salt',
          signer: getSdJwtSigner(agentContext, publicJwk),
          signAlg: options.alg,
        }).issue(
          {
            ...(JsonTransformer.toJSON(options.credential) as Record<string, unknown>),
            iat: 1698151532,
            cnf: { jku: 'https://issuer.example/jwks.json' },
          },
          undefined,
          { header: { typ: 'vc+sd-jwt', alg: options.alg, kid: options.verificationMethod } }
        )
        return W3cV2SdJwtVerifiableCredential.fromCompact(compact)
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
          format: ClaimFormat.SdJwtW3cVc,
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

        const presentation = await w3cV2JwtCredentialService.signPresentation(agentContext, {
          presentation: new W3cV2Presentation({
            context: [CREDENTIALS_CONTEXT_V2_URL],
            type: ['VerifiablePresentation'],
            verifiableCredential: [W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(credential)],
            holder: parties[options.presenter].did,
          }),
          challenge: 'challenge',
          domain: 'example.com',
          format: ClaimFormat.SdJwtW3cVp,
        })
        vi.mocked(Date.now).mockRestore()

        return new W3cV2CredentialService(
          {} as never,
          w3cV2JwtCredentialService,
          {} as never,
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

      async function presentCredentialWithKeyBindingJwt(nonce: string, aud = 'example.com', withoutDomain = false) {
        vi.spyOn(Date, 'now').mockReturnValue(1698151532000)
        const holderVerificationMethod = `${holderDidKey.did}#${holderDidKey.publicJwk.fingerprint}`
        const credential = await w3cV2JwtCredentialService.signCredential(agentContext, {
          alg: KnownJwaSignatureAlgorithms.ES256,
          format: ClaimFormat.SdJwtW3cVc,
          verificationMethod: issuerDidJwk.verificationMethodId,
          credential: JsonTransformer.fromJSON(Ed256DidJwkJwtVcUnsigned, W3cV2Credential),
          holder: { method: 'did', didUrl: holderVerificationMethod },
        })

        const sdJwtWithoutKbJwt = credential.encoded.endsWith('~') ? credential.encoded : `${credential.encoded}~`
        const { publicJwk } = await dids.resolveVerificationMethodFromCreatedDidRecord(holderVerificationMethod)
        const kbJwt = await new JwsService().createJwsCompact(agentContext, {
          keyId: publicJwk.keyId,
          payload: new JwtPayload({
            iat: 1698151532,
            aud,
            additionalClaims: {
              nonce,
              sd_hash: TypedArrayEncoder.toBase64Url(Hasher.hash(sdJwtWithoutKbJwt, 'sha-256')),
            },
          }),
          protectedHeaderOptions: { typ: 'kb+jwt', alg: KnownJwaSignatureAlgorithms.EdDSA },
        })
        const credentialWithKbJwt = W3cV2SdJwtVerifiableCredential.fromCompact(`${sdJwtWithoutKbJwt}${kbJwt}`)

        const presentation = await w3cV2JwtCredentialService.signPresentation(agentContext, {
          presentation: new W3cV2Presentation({
            context: [CREDENTIALS_CONTEXT_V2_URL],
            type: ['VerifiablePresentation'],
            verifiableCredential: [W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(credentialWithKbJwt)],
            holder: holderDidKey.did,
          }),
          challenge: 'challenge',
          domain: 'example.com',
          format: ClaimFormat.SdJwtW3cVp,
        })
        vi.mocked(Date.now).mockRestore()

        return new W3cV2CredentialService(
          {} as never,
          w3cV2JwtCredentialService,
          {} as never,
          {} as never
        ).verifyPresentation(agentContext, {
          presentation,
          challenge: 'challenge',
          domain: withoutDomain ? undefined : 'example.com',
        })
      }

      test('accepts a KB-JWT for the presentation', async () => {
        const result = await presentCredentialWithKeyBindingJwt('challenge')

        expect(result.credentialEntries[0]?.validations.signature).toEqual({ isValid: true })
        expect(result.isValid).toBe(true)
      })

      test('rejects a KB-JWT for another presentation', async () => {
        const result = await presentCredentialWithKeyBindingJwt('another-challenge')

        expect(result.credentialEntries[0]?.validations.signature).toMatchObject({
          isValid: false,
          error: { message: expect.stringContaining('Invalid Nonce') },
        })
        expect(result.isValid).toBe(false)
      })

      test('rejects a KB-JWT for another audience', async () => {
        const result = await presentCredentialWithKeyBindingJwt('challenge', 'another.example.com')

        expect(result.credentialEntries[0]?.validations.signature).toMatchObject({
          isValid: false,
          error: { message: expect.stringContaining('Invalid Key Binding audience') },
        })
        expect(result.isValid).toBe(false)
      })

      test('rejects a KB-JWT when no domain is given, even if the presentation has an audience', async () => {
        const result = await presentCredentialWithKeyBindingJwt('challenge', 'example.com', true)

        expect(result.credentialEntries[0]?.error?.message).toBe(
          'Credential has a KB-JWT, but no domain is provided to verify its audience'
        )
        expect(result.isValid).toBe(false)
      })

      describe('with a holder that has several authentication keys', () => {
        // A did:peer:2 with only `V` keys has two keys, both only under authentication
        let holderDid: string

        beforeAll(async () => {
          holderDid = `did:peer:2.V${holderDidKey.publicJwk.fingerprint}.V${secondHolderDidKey.publicJwk.fingerprint}`
          const keyIdOf = async (didKey: DidKey) =>
            (await dids.resolveVerificationMethodFromCreatedDidRecord(`${didKey.did}#${didKey.publicJwk.fingerprint}`))
              .publicJwk.keyId
          await dids.import({
            did: holderDid,
            keys: [
              { didDocumentRelativeKeyId: '#key-1', kmsKeyId: await keyIdOf(holderDidKey) },
              { didDocumentRelativeKeyId: '#key-2', kmsKeyId: await keyIdOf(secondHolderDidKey) },
            ],
          })
        })

        async function signBoundPresentation(cnfDidUrl: string) {
          const { id: _id, ...credentialSubject } = Ed256DidJwkJwtVcUnsigned.credentialSubject
          vi.spyOn(Date, 'now').mockReturnValue(1698151532000)
          try {
            const credential = await w3cV2JwtCredentialService.signCredential(agentContext, {
              alg: KnownJwaSignatureAlgorithms.ES256,
              format: ClaimFormat.SdJwtW3cVc,
              verificationMethod: issuerDidJwk.verificationMethodId,
              credential: JsonTransformer.fromJSON({ ...Ed256DidJwkJwtVcUnsigned, credentialSubject }, W3cV2Credential),
              holder: { method: 'did', didUrl: cnfDidUrl },
            })

            return await w3cV2JwtCredentialService.signPresentation(agentContext, {
              presentation: new W3cV2Presentation({
                context: [CREDENTIALS_CONTEXT_V2_URL],
                type: ['VerifiablePresentation'],
                verifiableCredential: [W3cV2EnvelopedVerifiableCredential.fromVerifiableCredential(credential)],
                holder: holderDid,
              }),
              challenge: 'challenge',
              domain: 'example.com',
              format: ClaimFormat.SdJwtW3cVp,
            })
          } finally {
            vi.mocked(Date.now).mockRestore()
          }
        }

        test('presents with the key the credential is bound to', async () => {
          const presentation = await signBoundPresentation(`${holderDid}#key-2`)

          expect(presentation.sdJwt.header.kid).toBe(`${holderDid}#key-2`)

          const result = await new W3cV2CredentialService(
            {} as never,
            w3cV2JwtCredentialService,
            {} as never,
            {} as never
          ).verifyPresentation(agentContext, { presentation, challenge: 'challenge', domain: 'example.com' })

          expect(result.credentialEntries[0]?.validations.holderBinding).toEqual({ isValid: true })
          expect(result.isValid).toBe(true)
        })

        test('throws when the credential is bound to none of the keys', async () => {
          await expect(signBoundPresentation(issuerDidJwk.verificationMethodId)).rejects.toThrow(
            `Unable to deterministically resolve signer key for presentation holder '${holderDid}'. Multiple locally controlled authentication verification methods found, and the presentation credentials are not bound to any of them.`
          )
        })
      })
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

    test('fails verification when challenge does not match nonce', async () => {
      const result = await w3cV2JwtCredentialService.verifyPresentation(agentContext, {
        presentation: CredoEs256DidKeyJwtVp,
        challenge: 'mismatched-challenge',
        domain: 'example.com',
      })

      expect(result.isValid).toBe(false)
      expect(result.presentation.isValid).toBe(false)
      expect(result.presentation.validations.dataModel?.isValid).toBe(false)
      expect(result.presentation.validations.dataModel?.error).toBeInstanceOf(CredoError)
      expect(result.presentation.validations.dataModel?.error?.message).toContain(
        "JWT payload 'nonce' does not match challenge"
      )
    })

    test('fails verification when requested domain is not in aud', async () => {
      const result = await w3cV2JwtCredentialService.verifyPresentation(agentContext, {
        presentation: CredoEs256DidKeyJwtVp,
        challenge: 'daf942ad-816f-45ee-a9fc-facd08e5abca',
        domain: 'unexpected.example.com',
      })

      expect(result.isValid).toBe(false)
      expect(result.presentation.isValid).toBe(false)
      expect(result.presentation.validations.dataModel?.isValid).toBe(false)
      expect(result.presentation.validations.dataModel?.error).toBeInstanceOf(CredoError)
      expect(result.presentation.validations.dataModel?.error?.message).toContain(
        "JWT payload 'aud' does not include domain 'unexpected.example.com'"
      )
    })

    test('logs SHOULD warning for presentation jti and id conflict', async () => {
      const jwtVp = W3cV2SdJwtVerifiablePresentation.fromCompact(CredoEs256DidKeyJwtVp)
      const warnSpy = vi.spyOn(agentContext.config.logger, 'warn')

      jwtVp.resolvedPresentation.id = 'urn:example:vp-id'
      jwtVp.sdJwt.prettyClaims.jti = 'urn:example:different-vp-jti'

      await w3cV2JwtCredentialService.verifyPresentation(agentContext, {
        presentation: jwtVp,
        challenge: 'daf942ad-816f-45ee-a9fc-facd08e5abca',
        domain: 'example.com',
      })

      expect(warnSpy).toHaveBeenCalledWith('VC-JOSE-COSE SHOULD warning: jti claim conflicts with presentation id', {
        format: 'vp+sd-jwt',
        jti: 'urn:example:different-vp-jti',
        presentationId: 'urn:example:vp-id',
      })

      warnSpy.mockRestore()
    })
  })
})
