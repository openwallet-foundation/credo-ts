import type {
  AgentContext,
  DidRegistrar,
  DidCreateOptions,
  DidCreateResult,
  DidDeactivateResult,
  DidUpdateResult,
  DidDocument,
  Jwk,
  VerificationMethod,
} from '@aries-framework/core'
import type { CheqdNetwork, DIDDocument, DidStdFee, TVerificationKey, VerificationMethods } from '@cheqd/sdk'
import type { SignInfo } from '@cheqd/ts-proto/cheqd/did/v2'

import {
  DidDocumentRole,
  DidRecord,
  DidRepository,
  KeyType,
  Key,
  Buffer,
  isValidPrivateKey,
} from '@aries-framework/core'
import { MethodSpecificIdAlgo, createDidVerificationMethod } from '@cheqd/sdk'
import { MsgCreateResourcePayload } from '@cheqd/ts-proto/cheqd/resource/v2'
import { fromString, toString } from 'uint8arrays'
import { v4 } from 'uuid'

import { CheqdSdkLedgerService } from '../ledger'

import {
  MsgCreateDidDocPayloadToSign,
  generateDidDoc,
  validateSpecCompliantPayload,
  fromMultibase,
  MsgDeactivateDidDocPayloadToSign,
} from './didCheqdUtil'

export class CheqdDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['cheqd']

  public async create(agentContext: AgentContext, options: CheqdDidCreateOptions): Promise<DidCreateResult> {
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)
    const cheqdSdkLedgerService = agentContext.dependencyManager.resolve(CheqdSdkLedgerService)

    const { methodSpecificIdAlgo, network, versionId = v4() } = options.options
    const { verificationMethod } = options.secret
    let didDocument: DidDocument

    if (options.didDocument && validateSpecCompliantPayload(options.didDocument)) {
      didDocument = options.didDocument
    } else if (verificationMethod) {
      const privateKey = verificationMethod.privateKey
      if (privateKey && !isValidPrivateKey(privateKey, KeyType.Ed25519)) {
        return {
          didDocumentMetadata: {},
          didRegistrationMetadata: {},
          didState: {
            state: 'failed',
            reason: 'Invalid private key provided',
          },
        }
      }

      const key = await agentContext.wallet.createKey({
        keyType: KeyType.Ed25519,
        privateKey: privateKey,
      })

      didDocument = generateDidDoc({
        verificationMethod: verificationMethod.type,
        verificationMethodId: verificationMethod.id || 'key-1',
        methodSpecificIdAlgo: methodSpecificIdAlgo || MethodSpecificIdAlgo.Uuid,
        network,
        publicKey: toString(key.publicKey, 'base64'),
      }) as DidDocument
    } else {
      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: 'Provide a didDocument or atleast one verificationMethod with seed in secret',
        },
      }
    }

    try {
      const payloadToSign = await MsgCreateDidDocPayloadToSign(didDocument as DIDDocument, versionId)
      const signInputs = await this.signPayload(agentContext, payloadToSign, didDocument.verificationMethod!)

      await cheqdSdkLedgerService.connect({ network })
      const response = await cheqdSdkLedgerService.create(signInputs, didDocument as DIDDocument, versionId)

      if (response.code !== 0) {
        throw new Error(`${response.rawLog}`)
      }

      // Save the did so we know we created it and can issue with it
      const didRecord = new DidRecord({
        did: didDocument.id,
        role: DidDocumentRole.Created,
        didDocument,
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
    const cheqdSdkLedgerService = agentContext.dependencyManager.resolve(CheqdSdkLedgerService)

    const { network, versionId = v4() } = options.options
    const verificationMethod = options.secret?.verificationMethod
    let didDocument: DidDocument
    let didRecord: DidRecord | null

    try {
      await cheqdSdkLedgerService.connect({ network })
      if (options.didDocument && validateSpecCompliantPayload(options.didDocument)) {
        didDocument = options.didDocument
        const resolvedDocument = await cheqdSdkLedgerService.resolve(didDocument.id)
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

        if (verificationMethod) {
          const privateKey = verificationMethod.privateKey
          if (privateKey && !isValidPrivateKey(privateKey, KeyType.Ed25519)) {
            return {
              didDocumentMetadata: {},
              didRegistrationMetadata: {},
              didState: {
                state: 'failed',
                reason: 'Invalid private key provided',
              },
            }
          }

          const key = await agentContext.wallet.createKey({
            keyType: KeyType.Ed25519,
            privateKey: privateKey,
          })

          didDocument.verificationMethod?.concat(
            createDidVerificationMethod(
              [verificationMethod.type],
              [
                {
                  methodSpecificId: didDocument.id.split(':')[3],
                  didUrl: didDocument.id,
                  keyId: `${didDocument.id}#${verificationMethod.id}`,
                  publicKey: toString(key.publicKey, 'base64'),
                },
              ]
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

      const payloadToSign = await MsgCreateDidDocPayloadToSign(didDocument as DIDDocument, versionId)
      const signInputs = await this.signPayload(agentContext, payloadToSign, didDocument.verificationMethod!)

      const response = await cheqdSdkLedgerService.update(signInputs, didDocument as DIDDocument, versionId)
      if (response.code !== 0) {
        throw new Error(`${response.rawLog}`)
      }

      // Save the did so we know we created it and can issue with it
      didRecord.didDocument = didDocument
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
    const cheqdSdkLedgerService = agentContext.dependencyManager.resolve(CheqdSdkLedgerService)

    const did = options.did
    const { versionId = v4() } = options.options

    try {
      const { didDocument, didDocumentMetadata } = await cheqdSdkLedgerService.resolve(did)
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
      const payloadToSign = MsgDeactivateDidDocPayloadToSign(didDocument, versionId)
      const signInputs = await this.signPayload(agentContext, payloadToSign, didDocument.verificationMethod!)
      await cheqdSdkLedgerService.connect({ network: did.split(':')[2] })
      const response = await cheqdSdkLedgerService.deactivate(signInputs, didDocument, versionId)
      if (response.code !== 0) {
        throw new Error(`${response.rawLog}`)
      }

      didRecord.role = DidDocumentRole.Deactivated
      await didRepository.save(agentContext, didRecord)

      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'finished',
          did: didDocument.id,
          didDocument: didDocument as DidDocument,
          secret: options.secret,
        },
      }
    } catch (error) {
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
    const cheqdSdkLedgerService = agentContext.dependencyManager.resolve(CheqdSdkLedgerService)
    await cheqdSdkLedgerService.connect({ network: did.split(':')[2] })
    const { didDocument, didDocumentMetadata } = await cheqdSdkLedgerService.resolve(did)
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
        data = fromString(resource.data, 'base64')
      } else if (typeof resource.data == 'object') {
        data = fromString(JSON.stringify(resource.data))
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
      const signInputs = await this.signPayload(agentContext, payloadToSign, didDocument.verificationMethod!)
      const response = await cheqdSdkLedgerService.createResource(signInputs, resourcePayload)
      if (response.code !== 0) {
        throw new Error(`${response.rawLog}`)
      }

      // TODO: add resource to didRecord
      // await didRepository.save(agentContext, didRecord)

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

  private async signPayload(agentContext: AgentContext, payload: Uint8Array, verificationMethod: VerificationMethod[]) {
    return await Promise.all(
      verificationMethod!.map(async (method) => {
        let key: Key
        if (method.publicKeyBase58) {
          key = Key.fromPublicKeyBase58(method.publicKeyBase58, KeyType.Ed25519)
        } else if (method.publicKeyJwk) {
          key = Key.fromJwk(method.publicKeyJwk as unknown as Jwk)
        } else {
          key = new Key(fromMultibase(method.publicKeyMultibase!), KeyType.Ed25519)
        }
        return {
          verificationMethodId: method.id,
          signature: await agentContext.wallet.sign({ data: Buffer.from(payload), key }),
        } as SignInfo
      })
    )
  }
}

export interface CheqdDidCreateOptions extends DidCreateOptions {
  method: 'cheqd'
  options: {
    network: CheqdNetwork
    rpcUrl?: string
    fee?: DidStdFee
    versionId?: string
    methodSpecificIdAlgo?: MethodSpecificIdAlgo
  }
  secret: {
    verificationMethod?: IVerificationMethod
  }
}

export interface CheqdDidUpdateOptions extends DidCreateOptions {
  method: 'cheqd'
  did: string
  didDocument: DidDocument
  options: {
    network: CheqdNetwork
    rpcUrl?: string
    fee?: DidStdFee
    versionId?: string
  }
  secret?: {
    verificationMethod: IVerificationMethod
  }
}

export interface CheqdDidDeactivateOptions extends DidCreateOptions {
  method: 'cheqd'
  did: string
  options: {
    network: CheqdNetwork
    rpcUrl?: string
    fee?: DidStdFee
    versionId?: string
  }
}

export interface CheqdCreateResourceOptions extends Omit<Partial<MsgCreateResourcePayload>, 'data'> {
  data: string | Uint8Array | object
}

interface IVerificationMethod {
  type: VerificationMethods
  id: TVerificationKey<string, number>
  privateKey?: Buffer
}
