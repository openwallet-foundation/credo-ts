import { askar } from '@openwallet-foundation/askar-nodejs'
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
import { ClassValidationError, CredoError } from '../../../../error'
import { JsonTransformer, TypedArrayEncoder } from '../../../../utils'
import { CacheModuleConfig, InMemoryLruCache } from '../../../cache'
import { DidJwk, DidKey, DidRepository, DidsApi, DidsModuleConfig } from '../../../dids'
import { KeyManagementApi, KnownJwaSignatureAlgorithms, PublicJwk } from '../../../kms'
import { X509ModuleConfig } from '../../../x509'
import { CREDENTIALS_CONTEXT_V2_URL } from '../../constants'
import { ClaimFormat, W3cV2Credential, W3cV2EnvelopedVerifiableCredential, W3cV2Presentation } from '../../models'
import { W3cV2SdJwtCredentialService } from '../W3cV2SdJwtCredentialService'
import { W3cV2SdJwtVerifiableCredential } from '../W3cV2SdJwtVerifiableCredential'
import {
  CredoEs256DidJwkJwtVc,
  CredoEs256DidJwkJwtVcIssuerSeed,
  CredoEs256DidJwkJwtVcSubjectSeed,
  CredoEs256DidKeyJwtVp,
  Ed256DidJwkJwtVcUnsigned,
} from './fixtures/credo-sd-jwt-vc'

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const storageService = new InMemoryStorageService<any>()
const config = getAgentConfig('W3cV2SdJwtCredentialService')
const agentContext = getAgentContext({
  registerInstances: [
    [InjectionSymbols.Logger, testLogger],
    [DidsModuleConfig, new DidsModuleConfig()],
    [DidRepository, new DidRepository(storageService, new EventEmitter(agentDependencies, new Subject()))],
    [InjectionSymbols.StorageService, storageService],
    [X509ModuleConfig, new X509ModuleConfig()],
    [
      AskarStoreManager,
      new AskarStoreManager(
        new NodeFileSystem(),
        new AskarModuleConfig({
          askar,
          store: getAskarStoreConfig('W3cV2SdJwtCredentialService'),
        })
      ),
    ],
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

kms.randomBytes = vi.fn(() => TypedArrayEncoder.fromString('salt'))
Date.prototype.getTime = vi.fn(() => 1698151532000)

describe('W3cV2SdJwtCredentialService', () => {
  let issuerDidJwk: DidJwk
  let holderDidKey: DidKey

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
  })

  describe('signCredential', () => {
    test('signs an ES256 JWT vc', async () => {
      const credential = JsonTransformer.fromJSON(Ed256DidJwkJwtVcUnsigned, W3cV2Credential)

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
          // This validates whether the signature is valid
          signature: {
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

      // @ts-ignore
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

      // @ts-ignore
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

      jwtVc.sdJwt.payload.exp = Math.floor(new Date('2020-01-01').getTime() / 1000)

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

      expect(result.validations.dataModel?.error?.message).toContain('JWT expired at 1698151532')
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

      const signedJwtVp = await w3cV2JwtCredentialService.signPresentation(agentContext, {
        presentation,
        challenge: 'daf942ad-816f-45ee-a9fc-facd08e5abca',
        domain: 'example.com',
        format: ClaimFormat.SdJwtW3cVp,
      })

      expect(signedJwtVp.encoded).toEqual(CredoEs256DidKeyJwtVp)
    })
  })

  describe('verifyPresentation', () => {
    test('verifies an ES256 JWT vp signed by Credo', async () => {
      const result = await w3cV2JwtCredentialService.verifyPresentation(agentContext, {
        presentation: CredoEs256DidKeyJwtVp,
        challenge: 'daf942ad-816f-45ee-a9fc-facd08e5abca',
        domain: 'example.com',
      })

      expect(result).toEqual({
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
          credentials: [
            {
              isValid: true,
              validations: {
                dataModel: {
                  isValid: true,
                },
                signature: {
                  isValid: true,
                },
                issuerIsSigner: {
                  isValid: true,
                },
                credentialSubjectAuthentication: {
                  isValid: true,
                },
              },
            },
          ],
        },
      })
    })
  })
})
