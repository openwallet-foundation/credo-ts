import {
  CheqdNetwork,
  type DIDDocument,
  type DidFeeOptions,
  type DidStdFee,
  MethodSpecificIdAlgo,
  VerificationMethods,
} from '@cheqd/sdk'
import type { SignInfo } from '@cheqd/ts-proto/cheqd/did/v2'
import { MsgCreateResourcePayload } from '@cheqd/ts-proto/cheqd/resource/v2/index.js'
import {
  AgentContext,
  DID_V1_CONTEXT_URL,
  type DidCreateOptions,
  type DidCreateResult,
  type DidDeactivateResult,
  DidDocument,
  DidDocumentBuilder,
  type DidDocumentKey,
  DidDocumentRole,
  DidRecord,
  type DidRegistrar,
  DidRepository,
  type DidUpdateOptions,
  type DidUpdateResult,
  getJsonWebKey2020,
  getKmsKeyIdForVerifiacationMethod,
  getPublicJwkFromVerificationMethod,
  JsonTransformer,
  Kms,
  SECURITY_ED25519_2018_CONTEXT_URL,
  SECURITY_ED25519_2020_CONTEXT_URL,
  SECURITY_JWS_CONTEXT_URL,
  TypedArrayEncoder,
  utils,
  VerificationMethod,
  type XOR,
} from '@credo-ts/core'

import { parseCheqdDid } from '../anoncreds/utils/identifiers'
import { CheqdLedgerService } from '../ledger'

import {
  createMsgCreateDidDocPayloadToSign,
  createMsgDeactivateDidDocPayloadToSign,
  decodeBase64OrBase64Url,
  generateDidDoc,
  validateSpecCompliantPayload,
} from './didCheqdUtil'

export class CheqdDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['cheqd']
  private contextMapping = {
    Ed25519VerificationKey2018: SECURITY_ED25519_2018_CONTEXT_URL,
    Ed25519VerificationKey2020: SECURITY_ED25519_2020_CONTEXT_URL,
    JsonWebKey2020: SECURITY_JWS_CONTEXT_URL,
  }

  private collectAllContexts(didDocument: DidDocument): Set<string> {
    const contextSet = new Set<string>(
      typeof didDocument.context === 'string'
        ? [didDocument.context]
        : Array.isArray(didDocument.context)
          ? didDocument.context
          : []
    )
    // List of verification relationships to check for embedded verification methods
    // Note: these are the relationships defined in the DID Core spec
    const relationships = [
      'authentication',
      'assertionMethod',
      'capabilityInvocation',
      'capabilityDelegation',
      'keyAgreement',
      'verificationMethod',
    ] as const
    // Collect verification methods from relationships
    for (const rel of relationships) {
      const entries = didDocument[rel]
      if (entries) {
        for (const entry of entries) {
          if (typeof entry !== 'string' && entry.type) {
            const contextUrl = this.contextMapping[entry.type as keyof typeof this.contextMapping]
            if (contextUrl) {
              contextSet.add(contextUrl)
            }
          }
        }
      }
    }
    return contextSet
  }

  public async create(agentContext: AgentContext, options: CheqdDidCreateOptions): Promise<DidCreateResult> {
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)
    const cheqdLedgerService = agentContext.dependencyManager.resolve(CheqdLedgerService)

    let didDocument: DidDocument
    const versionId = options.options?.versionId ?? utils.uuid()

    let keys: DidDocumentKey[] = []

    try {
      if (options.didDocument) {
        const isSpecCompliantPayload = validateSpecCompliantPayload(options.didDocument)
        if (!isSpecCompliantPayload.valid) {
          return {
            didDocumentMetadata: {},
            didRegistrationMetadata: {},
            didState: {
              state: 'failed',
              reason: `Invalid did document provided. ${isSpecCompliantPayload.error}`,
            },
          }
        }

        didDocument = options.didDocument
        const authenticationIds = didDocument.authentication?.map((v) => (typeof v === 'string' ? v : v.id)) ?? []
        const didDocumentRelativeKeyIds = options.options.keys.map((key) => key.didDocumentRelativeKeyId)
        keys = options.options.keys

        // Ensure all keys are present in the did document
        for (const didDocumentKeyId of didDocumentRelativeKeyIds) {
          didDocument.dereferenceKey(didDocumentKeyId)
        }

        if (!authenticationIds.every((id) => didDocumentRelativeKeyIds.includes(id.replace(didDocument.id, '')))) {
          return {
            didDocumentMetadata: {},
            didRegistrationMetadata: {},
            didState: {
              state: 'failed',
              reason: `For all 'authentication' verification methods in the did document a 'key' entry in the options MUST be provided that link the did document key id with the kms key id`,
            },
          }
        }

        const cheqdDid = parseCheqdDid(options.didDocument.id)

        if (!cheqdDid) {
          return {
            didDocumentMetadata: {},
            didRegistrationMetadata: {},
            didState: {
              state: 'failed',
              reason: `Unable to parse cheqd did ${options.didDocument.id}`,
            },
          }
        }
      } else if (options.options.createKey || options.options.keyId) {
        const methodSpecificIdAlgo = options.options.methodSpecificIdAlgo
        const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)

        let publicJwk: SupportedPublicJwk
        if (options.options.createKey) {
          const createKeyResult = await kms.createKey<Kms.KmsCreateKeyType>(options.options.createKey)
          if (!isSupportedPublicJwk(createKeyResult.publicJwk)) {
            return {
              didDocumentMetadata: {},
              didRegistrationMetadata: {},
              didState: {
                state: 'failed',
                reason: `created key uses unsupported ${Kms.getJwkHumanDescription(createKeyResult.publicJwk)} for did:cheqd`,
              },
            }
          }
          publicJwk = createKeyResult.publicJwk
          keys.push({
            kmsKeyId: createKeyResult.keyId,
            didDocumentRelativeKeyId: '#key-1',
          })
        } else {
          const _publicJwk = await kms.getPublicKey({
            keyId: options.options.keyId,
          })
          keys.push({
            kmsKeyId: options.options.keyId,
            didDocumentRelativeKeyId: '#key-1',
          })
          if (!_publicJwk) {
            return {
              didDocumentMetadata: {},
              didRegistrationMetadata: {},
              didState: {
                state: 'failed',
                reason: `notFound: key with key id '${options.options.keyId}' not found`,
              },
            }
          }

          if (!isSupportedPublicJwk(_publicJwk)) {
            return {
              didDocumentMetadata: {},
              didRegistrationMetadata: {},
              didState: {
                state: 'failed',
                reason: `key with key id '${options.options.keyId}' uses unsupported ${Kms.getJwkHumanDescription(
                  _publicJwk
                )} for did:cheqd`,
              },
            }
          }

          publicJwk = _publicJwk
        }

        const jwk = Kms.PublicJwk.fromPublicJwk(publicJwk)

        if (publicJwk.kty === 'EC') {
          // Indy-style (base58btc) identifiers are derived from an Ed25519 key
          if (methodSpecificIdAlgo === MethodSpecificIdAlgo.Base58) {
            return {
              didDocumentMetadata: {},
              didRegistrationMetadata: {},
              didState: {
                state: 'failed',
                reason: `methodSpecificIdAlgo 'base58btc' requires an Ed25519 key, but got ${Kms.getJwkHumanDescription(publicJwk)}`,
              },
            }
          }

          const did = `did:cheqd:${options.options.network}:${utils.uuid()}`
          const keyId = `${did}#key-1`
          didDocument = new DidDocumentBuilder(did)
            .addContext(SECURITY_JWS_CONTEXT_URL)
            .addVerificationMethod(getJsonWebKey2020({ did, publicJwk: jwk, verificationMethodId: keyId }))
            .addAuthentication(keyId)
            .addAssertionMethod(keyId)
            .build()
        } else {
          // TODO: make this configureable
          didDocument = generateDidDoc({
            verificationMethod: VerificationMethods.JWK,
            verificationMethodId: 'key-1',
            methodSpecificIdAlgo: (methodSpecificIdAlgo as MethodSpecificIdAlgo) || MethodSpecificIdAlgo.Uuid,
            network: options.options.network as CheqdNetwork,
            publicKey: TypedArrayEncoder.toHex(jwk.publicKey.publicKey),
          })
        }
      } else {
        return {
          didDocumentMetadata: {},
          didRegistrationMetadata: {},
          didState: {
            state: 'failed',
            reason: 'Provide a didDocument or provide createKey or keyId in options',
          },
        }
      }

      // Collect all contexts from the didDic into a set
      const contextSet = this.collectAllContexts(didDocument)
      // Add Cheqd default context to the did document
      didDocument.context = Array.from(contextSet.add(DID_V1_CONTEXT_URL))

      const didDocumentJson = didDocument.toJSON() as DIDDocument
      const payloadToSign = await createMsgCreateDidDocPayloadToSign(didDocumentJson, versionId)

      const authentication = didDocument.findVerificationMethodsByPurpose(['authentication'])
      if (!authentication || authentication.length === 0) {
        return {
          didDocumentMetadata: {},
          didRegistrationMetadata: {},
          didState: {
            state: 'failed',
            reason: "No keys to sign with in 'authentication' of DID document",
          },
        }
      }

      const signInputs = await this.signPayload(agentContext, payloadToSign, authentication, keys)

      const response = await cheqdLedgerService.create(didDocumentJson, signInputs, versionId)
      if (response.code !== 0) {
        throw new Error(`${response.rawLog}`)
      }

      // Save the did so we know we created it and can issue with it
      const didRecord = new DidRecord({
        did: didDocument.id,
        role: DidDocumentRole.Created,
        didDocument,
        keys,
      })
      await didRepository.save(agentContext, didRecord)

      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'finished',
          did: didDocument.id,
          didDocument,
          secret: options.secret,
        },
      }
    } catch (error) {
      agentContext.config.logger.error('Error registering DID', error)
      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: `unknownError: ${error.message}`,
        },
      }
    }
  }

  public async update(agentContext: AgentContext, options: CheqdDidUpdateOptions): Promise<DidUpdateResult> {
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)
    const cheqdLedgerService = agentContext.dependencyManager.resolve(CheqdLedgerService)

    const versionId = options.options?.versionId || utils.uuid()
    let didDocument: DidDocument
    let didRecord: DidRecord | null
    let previousDocument: DIDDocument | undefined

    try {
      if (options.didDocument) {
        const isSpecCompliantPayload = validateSpecCompliantPayload(options.didDocument)
        if (!isSpecCompliantPayload.valid) {
          return {
            didDocumentMetadata: {},
            didRegistrationMetadata: {},
            didState: {
              state: 'failed',
              reason: `Invalid did document provided. ${isSpecCompliantPayload.error}`,
            },
          }
        }

        didDocument = options.didDocument
        const resolvedDocument = await cheqdLedgerService.resolve(didDocument.id)
        didRecord = await didRepository.findCreatedDid(agentContext, didDocument.id)
        if (!resolvedDocument.didDocument || resolvedDocument.didDocumentMetadata.deactivated || !didRecord) {
          return {
            didDocumentMetadata: {},
            didRegistrationMetadata: {},
            didState: {
              state: 'failed',
              reason: 'Did not found',
            },
          }
        }

        previousDocument = resolvedDocument.didDocument as DIDDocument

        // Older did records have no keys. Set them on the record, so keys added below are saved with it
        didRecord.keys = didRecord.keys ?? []
        const keys = didRecord.keys
        // Link did document keys to kms keys, replacing an existing entry for the same did document key
        for (const key of options.options?.keys ?? []) {
          const index = keys.findIndex((k) => k.didDocumentRelativeKeyId === key.didDocumentRelativeKeyId)
          if (index === -1) keys.push(key)
          else keys[index] = key
        }
        if (options.options?.createKey || options.options?.keyId) {
          const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
          let createdKey: DidDocumentKey

          let publicJwk: SupportedPublicJwk
          if (options.options.createKey) {
            const createKeyResult = await kms.createKey<Kms.KmsCreateKeyType>(options.options.createKey)
            if (!isSupportedPublicJwk(createKeyResult.publicJwk)) {
              return {
                didDocumentMetadata: {},
                didRegistrationMetadata: {},
                didState: {
                  state: 'failed',
                  reason: `created key uses unsupported ${Kms.getJwkHumanDescription(createKeyResult.publicJwk)} for did:cheqd`,
                },
              }
            }
            publicJwk = createKeyResult.publicJwk

            createdKey = {
              didDocumentRelativeKeyId: `#${utils.uuid()}-1`,
              kmsKeyId: createKeyResult.keyId,
            }
          } else if (options.options.keyId) {
            const _publicJwk = await kms.getPublicKey({
              keyId: options.options.keyId,
            })
            createdKey = {
              didDocumentRelativeKeyId: `#${utils.uuid()}-1`,
              kmsKeyId: options.options.keyId,
            }
            if (!_publicJwk) {
              return {
                didDocumentMetadata: {},
                didRegistrationMetadata: {},
                didState: {
                  state: 'failed',
                  reason: `notFound: key with key id '${options.options.keyId}' not found`,
                },
              }
            }

            if (!isSupportedPublicJwk(_publicJwk)) {
              return {
                didDocumentMetadata: {},
                didRegistrationMetadata: {},
                didState: {
                  state: 'failed',
                  reason: `key with key id '${options.options.keyId}' uses unsupported ${Kms.getJwkHumanDescription(
                    _publicJwk
                  )} for did:cheqd`,
                },
              }
            }

            publicJwk = _publicJwk
          } else {
            // This will never happen, but to make TS happy
            return {
              didDocumentMetadata: {},
              didRegistrationMetadata: {},
              didState: {
                state: 'failed',
                reason: 'Expect options.createKey or options.keyId',
              },
            }
          }

          // Add the key as a verification method (the previous concat discarded its result)
          const jwk = Kms.PublicJwk.fromPublicJwk(publicJwk)
          keys.push(createdKey)
          didDocument.verificationMethod = [
            ...(didDocument.verificationMethod ?? []),
            getJsonWebKey2020({
              did: didDocument.id,
              publicJwk: jwk,
              verificationMethodId: `${didDocument.id}${createdKey.didDocumentRelativeKeyId}`,
            }),
          ]
        }
      } else {
        return {
          didDocumentMetadata: {},
          didRegistrationMetadata: {},
          didState: {
            state: 'failed',
            reason: 'Provide a valid didDocument',
          },
        }
      }

      // Keys of the previous version are still needed to sign for authentication entries that are removed
      const previousKeys = [...(didRecord.keys ?? [])]

      // Filter out all keys that are not present in the did document anymore
      didRecord.keys = didRecord.keys?.filter(({ didDocumentRelativeKeyId }) => {
        try {
          didDocument.dereferenceKey(didDocumentRelativeKeyId)
          return true
        } catch (_error) {
          return false
        }
      })

      // TODO: we don't know which keys are managed by Credo. Should we
      // create a keys array for all keys within the did document set to the legacy key id
      // TODO: we need some sort of migration plan, otherwise we will have to support
      // legacy key ids forever
      // const authenticationIds = didDocument.authentication?.map(a => typeof a === 'string' ? a : a.id) ?? []
      // const didDocumentKeyIds = didRecord.keys?.map(({didDocumentRelativeKeyId}) => didDocumentRelativeKeyId)
      //  if (!authenticationIds.every((id) => didDocumentKeyIds?.includes(id))) {
      //     return {
      //       didDocumentMetadata: {},
      //       didRegistrationMetadata: {},
      //       didState: {
      //         state: "failed",
      //         reason: `For all 'authentication' verification methods in the did document a 'key' entry in the options MUST be provided that link the did document key id with the kms key id`,
      //       },
      //     };
      //   }

      const payloadToSign = await createMsgCreateDidDocPayloadToSign(didDocument.toJSON() as DIDDocument, versionId)

      const authentication = didDocument.findVerificationMethodsByPurpose(['authentication'])
      if (!authentication || authentication.length === 0) {
        return {
          didDocumentMetadata: {},
          didRegistrationMetadata: {},
          didState: {
            state: 'failed',
            reason: "No keys to sign with in 'authentication' of DID document",
          },
        }
      }
      // The ledger requires signatures from authentication entries of the previous version that are removed
      const newAuthenticationIds = authentication.map((method) => method.id)
      const removedAuthentication = (previousDocument?.authentication ?? [])
        .map((entry) => (typeof entry === 'string' ? entry : entry.id))
        .filter((id) => !newAuthenticationIds.includes(id))
        .map((id) => previousDocument?.verificationMethod?.find((method) => method.id === id))
        .filter((method) => method !== undefined)
        .map((method) => JsonTransformer.fromJSON(method, VerificationMethod))

      const signInputs = await this.signPayload(
        agentContext,
        payloadToSign,
        [...authentication, ...removedAuthentication],
        previousKeys
      )

      const response = await cheqdLedgerService.update(didDocument.toJSON() as DIDDocument, signInputs, versionId)
      if (response.code !== 0) {
        throw new Error(`${response.rawLog}`)
      }
      // Collect all contexts, override existing context if provided
      const contextSet = this.collectAllContexts(options.didDocument || didDocument)
      // Add Cheqd default context to the did document
      didDocument.context = Array.from(contextSet.add(DID_V1_CONTEXT_URL))
      // Save the did so we know we created it and can issue with it
      didRecord.didDocument = didDocument
      await didRepository.update(agentContext, didRecord)

      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'finished',
          did: didDocument.id,
          didDocument,
          secret: options.secret,
        },
      }
    } catch (error) {
      agentContext.config.logger.error('Error updating DID', error)
      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: `unknownError: ${error.message}`,
        },
      }
    }
  }

  public async deactivate(
    agentContext: AgentContext,
    options: CheqdDidDeactivateOptions
  ): Promise<DidDeactivateResult> {
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)
    const cheqdLedgerService = agentContext.dependencyManager.resolve(CheqdLedgerService)

    const did = options.did
    const versionId = options.options?.versionId || utils.uuid()

    try {
      const { didDocument, didDocumentMetadata } = await cheqdLedgerService.resolve(did)

      const didRecord = await didRepository.findCreatedDid(agentContext, did)
      if (!didDocument || didDocumentMetadata.deactivated || !didRecord) {
        return {
          didDocumentMetadata: {},
          didRegistrationMetadata: {},
          didState: {
            state: 'failed',
            reason: 'Did not found',
          },
        }
      }
      const payloadToSign = createMsgDeactivateDidDocPayloadToSign(didDocument, versionId)
      const didDocumentInstance = DidDocument.fromJSON(didDocument)

      const authentication = didDocumentInstance.findVerificationMethodsByPurpose(['authentication'])
      if (!authentication || authentication.length === 0) {
        return {
          didDocumentMetadata: {},
          didRegistrationMetadata: {},
          didState: {
            state: 'failed',
            reason: "No keys to sign with in 'authentication' of DID document",
          },
        }
      }
      const signInputs = await this.signPayload(agentContext, payloadToSign, authentication, didRecord.keys)
      const response = await cheqdLedgerService.deactivate(didDocument, signInputs, versionId)
      if (response.code !== 0) {
        throw new Error(`${response.rawLog}`)
      }

      await didRepository.update(agentContext, didRecord)

      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'finished',
          did: didDocument.id,
          didDocument: JsonTransformer.fromJSON(didRecord.didDocument, DidDocument),
          secret: options.secret,
        },
      }
    } catch (error) {
      agentContext.config.logger.error('Error deactivating DID', error)
      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: `unknownError: ${error.message}`,
        },
      }
    }
  }

  public async createResource(agentContext: AgentContext, did: string, resource: CheqdCreateResourceOptions) {
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)
    const cheqdLedgerService = agentContext.dependencyManager.resolve(CheqdLedgerService)
    const { didDocument, didDocumentMetadata } = await cheqdLedgerService.resolve(did)
    const didRecord = await didRepository.findCreatedDid(agentContext, did)
    if (!didDocument || didDocumentMetadata.deactivated || !didRecord) {
      return {
        resourceMetadata: {},
        resourceRegistrationMetadata: {},
        resourceState: {
          state: 'failed',
          reason: `DID: ${did} not found`,
        },
      }
    }

    try {
      let data: Uint8Array
      if (typeof resource.data === 'string') {
        data = decodeBase64OrBase64Url(resource.data)
      } else if (resource.data instanceof Uint8Array) {
        // Must be checked before the object case, a Uint8Array is also an object
        data = resource.data
      } else {
        data = TypedArrayEncoder.fromUtf8String(JSON.stringify(resource.data))
      }

      const resourcePayload = MsgCreateResourcePayload.fromPartial({
        collectionId: did.split(':')[3],
        id: resource.id,
        resourceType: resource.resourceType,
        name: resource.name,
        version: resource.version,
        alsoKnownAs: resource.alsoKnownAs,
        data,
      })
      const payloadToSign = MsgCreateResourcePayload.encode(resourcePayload).finish()

      const didDocumentInstance = JsonTransformer.fromJSON(didDocument, DidDocument)
      const signInputs = await this.signPayload(
        agentContext,
        payloadToSign,
        didDocumentInstance.verificationMethod,
        didRecord.keys
      )
      const response = await cheqdLedgerService.createResource(
        did,
        resourcePayload,
        signInputs,
        resource.fee,
        resource.feeOptions
      )
      if (response.code !== 0) {
        throw new Error(`${response.rawLog}`)
      }

      return {
        resourceMetadata: {},
        resourceRegistrationMetadata: {},
        resourceState: {
          state: 'finished',
          resourceId: resourcePayload.id,
          resource: resourcePayload,
        },
      }
    } catch (error) {
      return {
        resourceMetadata: {},
        resourceRegistrationMetadata: {},
        resourceState: {
          state: 'failed',
          reason: `unknownError: ${error.message}`,
        },
      }
    }
  }

  private async signPayload(
    agentContext: AgentContext,
    payload: Uint8Array,
    verificationMethod: VerificationMethod[] = [],
    keys?: DidDocumentKey[]
  ) {
    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
    return await Promise.all(
      verificationMethod.map(async (method) => {
        const publicJwk = getPublicJwkFromVerificationMethod(method)
        const kmsKeyId = getKmsKeyIdForVerifiacationMethod(method, keys) ?? publicJwk.legacyKeyId

        const { signature } = await kms.sign({
          data: payload,
          algorithm: publicJwk.signatureAlgorithm,
          keyId: kmsKeyId,
        })

        // EC signatures need to be sent as DER encoded for Cheqd
        const jwk = publicJwk.toJson()
        if (jwk.kty === 'EC') {
          return {
            verificationMethodId: method.id,
            signature: Kms.rawEcSignatureToDer(signature, jwk.crv),
          }
        }

        return {
          verificationMethodId: method.id,
          signature,
        } satisfies SignInfo
      })
    )
  }
}

type KmsCreateKeyOptionsOkpEd25519 = Kms.KmsCreateKeyOptions<Kms.KmsCreateKeyTypeOkp & { crv: 'Ed25519' }>
type KmsCreateKeyOptionsEcP256 = Kms.KmsCreateKeyOptions<Kms.KmsCreateKeyTypeEc & { crv: 'P-256' }>

/** Key types accepted for did:cheqd verification methods (JsonWebKey2020) */
type SupportedPublicJwk = (Kms.KmsJwkPublicOkp & { crv: 'Ed25519' }) | (Kms.KmsJwkPublicEc & { crv: 'P-256' })

function isSupportedPublicJwk(jwk: Kms.KmsJwkPublic): jwk is SupportedPublicJwk {
  return (jwk.kty === 'OKP' && jwk.crv === 'Ed25519') || (jwk.kty === 'EC' && jwk.crv === 'P-256')
}

type KmsCreateKeyOptionsDidCheqd = KmsCreateKeyOptionsOkpEd25519 | KmsCreateKeyOptionsEcP256

export interface CheqdDidCreateWithoutDidDocumentOptions extends DidCreateOptions {
  method: 'cheqd'
  did?: never
  didDocument?: never
  secret?: never

  options: {
    network: `${CheqdNetwork}`
    fee?: DidStdFee
    feeOptions?: DidFeeOptions
    versionId?: string
    methodSpecificIdAlgo?: `${MethodSpecificIdAlgo}`
  } & XOR<{ createKey: KmsCreateKeyOptionsDidCheqd }, { keyId: string }>
}

export interface CheqdDidCreateFromDidDocumentOptions extends DidCreateOptions {
  method: 'cheqd'
  did?: undefined
  didDocument: DidDocument
  options: {
    /**
     * The linking between the did document keys and the kms keys. For cheqd dids ALL authentication entries MUST sign the request
     * and thus it is required to a mapping for all keys.
     */
    keys: DidDocumentKey[]
    fee?: DidStdFee
    feeOptions?: DidFeeOptions
    versionId?: string
  }
}

export type CheqdDidCreateOptions = CheqdDidCreateFromDidDocumentOptions | CheqdDidCreateWithoutDidDocumentOptions

export interface CheqdDidUpdateOptions extends DidUpdateOptions {
  did: string
  didDocument: DidDocument
  secret?: never

  options?: {
    /**
     * The linking between the did document keys and the kms keys. The existing keys will be filtered based on the keys not present
     * in the did document anymore, and this new list will be merged into it.
     */
    keys?: DidDocumentKey[]

    fee?: DidStdFee
    feeOptions?: DidFeeOptions
    versionId?: string
  } & XOR<{ createKey?: KmsCreateKeyOptionsDidCheqd }, { keyId?: string }>
}

export interface CheqdDidDeactivateOptions extends DidCreateOptions {
  method: 'cheqd'
  did: string
  options: {
    fee?: DidStdFee
    feeOptions?: DidFeeOptions
    versionId?: string
  }
}

export interface CheqdCreateResourceOptions extends Pick<MsgCreateResourcePayload, 'id' | 'name' | 'resourceType'> {
  data: string | Uint8Array | object
  collectionId?: MsgCreateResourcePayload['collectionId']
  version?: MsgCreateResourcePayload['version']
  alsoKnownAs?: MsgCreateResourcePayload['alsoKnownAs']
  fee?: DidStdFee
  feeOptions?: DidFeeOptions
}
