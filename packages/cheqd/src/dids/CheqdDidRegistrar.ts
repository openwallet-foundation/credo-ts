import { CheqdNetwork, DIDDocument, DidStdFee, VerificationMethods } from '@cheqd/sdk'
import type { SignInfo } from '@cheqd/ts-proto/cheqd/did/v2'
import {
  AgentContext,
  DidCreateOptions,
  DidCreateResult,
  DidDeactivateResult,
  DidDocumentKey,
  DidRegistrar,
  DidUpdateOptions,
  DidUpdateResult,
  Kms,
  XOR,
  getKmsKeyIdForVerifiacationMethod,
  getPublicJwkFromVerificationMethod,
} from '@credo-ts/core'

import { MethodSpecificIdAlgo, createDidVerificationMethod } from '@cheqd/sdk'
import { MsgCreateResourcePayload } from '@cheqd/ts-proto/cheqd/resource/v2'
import {
  DidDocument,
  DidDocumentRole,
  DidRecord,
  DidRepository,
  JsonTransformer,
  TypedArrayEncoder,
  VerificationMethod,
  utils,
} from '@credo-ts/core'

import { parseCheqdDid } from '../anoncreds/utils/identifiers'
import { CheqdLedgerService } from '../ledger'

import { KmsJwkPublicOkp } from '@credo-ts/core/src/modules/kms'
import {
  createMsgCreateDidDocPayloadToSign,
  createMsgDeactivateDidDocPayloadToSign,
  generateDidDoc,
  validateSpecCompliantPayload,
} from './didCheqdUtil'

export class CheqdDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['cheqd']

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

        let publicJwk: KmsJwkPublicOkp & { crv: 'Ed25519' }
        if (options.options.createKey) {
          const createKeyResult = await kms.createKey(options.options.createKey)
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

          if (_publicJwk.kty !== 'OKP' || _publicJwk.crv !== 'Ed25519') {
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

          publicJwk = {
            ..._publicJwk,
            crv: _publicJwk.crv,
          }
        }

        // TODO: make this configureable
        const verificationMethod = VerificationMethods.JWK
        const jwk = Kms.PublicJwk.fromPublicJwk(publicJwk)

        didDocument = generateDidDoc({
          verificationMethod,
          verificationMethodId: 'key-1',
          methodSpecificIdAlgo: (methodSpecificIdAlgo as MethodSpecificIdAlgo) || MethodSpecificIdAlgo.Uuid,
          network: options.options.network as CheqdNetwork,
          publicKey: TypedArrayEncoder.toHex(jwk.publicKey.publicKey),
        })

        const contextMapping = {
          Ed25519VerificationKey2018: 'https://w3id.org/security/suites/ed25519-2018/v1',
          Ed25519VerificationKey2020: 'https://w3id.org/security/suites/ed25519-2020/v1',
          JsonWebKey2020: 'https://w3id.org/security/suites/jws-2020/v1',
        }
        const contextUrl = contextMapping[verificationMethod]

        // Add the context to the did document
        // NOTE: cheqd sdk uses https://www.w3.org/ns/did/v1 while Credo did doc uses https://w3id.org/did/v1
        // We should align these at some point. For now we just return a consistent value.
        didDocument.context = ['https://www.w3.org/ns/did/v1', contextUrl]
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

      const didDocumentJson = didDocument.toJSON() as DIDDocument
      const payloadToSign = await createMsgCreateDidDocPayloadToSign(didDocumentJson, versionId)

      const authentication = didDocument.authentication?.map((authentication) =>
        typeof authentication === 'string' ? didDocument.dereferenceVerificationMethod(authentication) : authentication
      )
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

        const keys = didRecord.keys ?? []
        if (options.options?.createKey || options.options?.keyId) {
          const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
          let createdKey: DidDocumentKey

          let publicJwk: KmsJwkPublicOkp & { crv: 'Ed25519' }
          if (options.options.createKey) {
            const createKeyResult = await kms.createKey(options.options.createKey)
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

            if (_publicJwk.kty !== 'OKP' || _publicJwk.crv !== 'Ed25519') {
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

            publicJwk = {
              ..._publicJwk,
              crv: _publicJwk.crv,
            }
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

          // TODO: make this configureable
          const verificationMethod = VerificationMethods.JWK
          const jwk = Kms.PublicJwk.fromPublicJwk(publicJwk)

          keys.push(createdKey)
          didDocument.verificationMethod?.concat(
            JsonTransformer.fromJSON(
              createDidVerificationMethod(
                [verificationMethod],
                [
                  {
                    methodSpecificId: didDocument.id.split(':')[3],
                    didUrl: didDocument.id,
                    keyId: `${didDocument.id}${createdKey.didDocumentRelativeKeyId}` as `${string}#${string}-${number}`,
                    publicKey: TypedArrayEncoder.toHex(jwk.publicKey.publicKey),
                  },
                ]
              ),
              VerificationMethod
            )
          )
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

      const authentication = didDocument.authentication?.map((authentication) =>
        typeof authentication === 'string' ? didDocument.dereferenceVerificationMethod(authentication) : authentication
      )
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
      const signInputs = await this.signPayload(
        agentContext,
        payloadToSign,
        // TOOD: we should also sign with the authentication entries that are removed (so we should diff)
        authentication,
        didRecord.keys
      )

      const response = await cheqdLedgerService.update(didDocument.toJSON() as DIDDocument, signInputs, versionId)
      if (response.code !== 0) {
        throw new Error(`${response.rawLog}`)
      }

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

      const authentication = didDocumentInstance.authentication?.map((authentication) =>
        typeof authentication === 'string'
          ? didDocumentInstance.dereferenceVerificationMethod(authentication)
          : authentication
      )
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
          didDocument: JsonTransformer.fromJSON(didDocument, DidDocument),
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
        data = TypedArrayEncoder.fromBase64(resource.data)
      } else if (typeof resource.data === 'object') {
        data = TypedArrayEncoder.fromString(JSON.stringify(resource.data))
      } else {
        data = resource.data
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
      const response = await cheqdLedgerService.createResource(did, resourcePayload, signInputs)
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

export interface CheqdDidCreateWithoutDidDocumentOptions extends DidCreateOptions {
  method: 'cheqd'
  did?: never
  didDocument?: never
  secret?: never

  options: {
    network: `${CheqdNetwork}`
    fee?: DidStdFee
    versionId?: string
    methodSpecificIdAlgo?: `${MethodSpecificIdAlgo}`
  } & XOR<{ createKey: KmsCreateKeyOptionsOkpEd25519 }, { keyId: string }>
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
    versionId?: string
  } & XOR<{ createKey?: KmsCreateKeyOptionsOkpEd25519 }, { keyId?: string }>
}

export interface CheqdDidDeactivateOptions extends DidCreateOptions {
  method: 'cheqd'
  did: string
  options: {
    fee?: DidStdFee
    versionId?: string
  }
}

export interface CheqdCreateResourceOptions extends Pick<MsgCreateResourcePayload, 'id' | 'name' | 'resourceType'> {
  data: string | Uint8Array | object
  collectionId?: MsgCreateResourcePayload['collectionId']
  version?: MsgCreateResourcePayload['version']
  alsoKnownAs?: MsgCreateResourcePayload['alsoKnownAs']
}
