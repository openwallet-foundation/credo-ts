import type {
  AgentContext,
  DidRegistrar,
  DidCreateOptions,
  DidCreateResult,
  DidDeactivateResult,
  DidDocument,
  DidUpdateResult,
  DidUpdateOptions,
  DidDocumentRole,
} from '@credo-ts/core'

import { MultibaseEncoder, Buffer, DidRepository, DidRecord, isValidPrivateKey, KeyType } from '@credo-ts/core'
import { createDID, updateDID } from 'didwebvh-ts'

import { WebvhModuleConfig } from '../WebvhModuleConfig'

import { generateDidDoc } from './didWebvhUtil'

export class WebvhDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['webvh']

  public async create(agentContext: AgentContext, options: WebvhDidCreateOptions): Promise<DidCreateResult> {
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)
    const webvhModuleConfig = agentContext.dependencyManager.resolve(WebvhModuleConfig)

    let didDocument: DidDocument

    try {
      if (options.didDocument) {
        didDocument = options.didDocument
      } else if (options.secret?.verificationMethod) {
        const verificationMethod = options.secret.verificationMethod
        const privateKeyMultibase = verificationMethod.privateKeyMultibase
        if (!privateKeyMultibase) {
          return {
            didDocumentMetadata: {},
            didRegistrationMetadata: {},
            didState: {
              state: 'failed',
              reason: 'Invalid private key provided',
            },
          }
        }
        const privateKey = Buffer.from(MultiBaseEncoder.decode(privateKeyMultibase).data)
        if (privateKeyMultibase && !isValidPrivateKey(privateKey, KeyType.Ed25519)) {
          return {
            didDocumentMetadata: {},
            didRegistrationMetadata: {},
            didState: {
              state: 'failed',
              reason: 'Invalid private key provided',
            },
          }
        }

        await agentContext.wallet.createKey({
          keyType: KeyType.Ed25519,
          privateKey,
        })

        didDocument = await generateDidDoc({
          verificationMethods: [verificationMethod],
          updateKeys: [verificationMethod.publicKeyMultibase],
          baseUrl: webvhModuleConfig.baseUrl,
        }, agentContext)
      } else {
        return {
          didDocumentMetadata: {},
          didRegistrationMetadata: {},
          didState: {
            state: 'failed',
            reason: 'Provide a didDocument or at least one verificationMethod with seed in secret',
          },
        }
      }

      // Register the DID using didwebvh-ts
      const response = await createDID()
      
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
      agentContext.config.logger.error(`Error registering DID`, error)
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

  public async update(agentContext: AgentContext, options: WebvhDidUpdateOptions): Promise<DidUpdateResult> {
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)

    try {
      if (!options.didDocument) {
        return {
          didDocumentMetadata: {},
          didRegistrationMetadata: {},
          didState: {
            state: 'failed',
            reason: 'Provide a valid didDocument',
          },
        }
      }

      // Update the DID using didwebvh-ts
      const response = await updateDID({doc: options.didDocument.toJSON()})
      
      // Update the did record
      const didRecord = await didRepository.findCreatedDid(agentContext, options.did)
      if (didRecord) {
        didRecord.didDocument = options.didDocument
        await didRepository.update(agentContext, didRecord)
      }

      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'finished',
          did: options.did,
          didDocument: options.didDocument,
        },
      }
    } catch (error) {
      agentContext.config.logger.error(`Error updating DID`, error)
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

  public async deactivate(agentContext: AgentContext, options: WebvhDidDeactivateOptions): Promise<DidDeactivateResult> {
    // const didRepository = agentContext.dependencyManager.resolve(DidRepository)

    // try {
    //   // Deactivate the DID using didwebvh-ts
    //   const response = await deactivateDID(options.did)
      
    //   // Update the did record
    //   const didRecord = await didRepository.findCreatedDid(agentContext, options.did)
    //   if (didRecord) {
    //     await didRepository.update(agentContext, didRecord)
    //   }

    //   return {
    //     didDocumentMetadata: {},
    //     didRegistrationMetadata: {},
    //     didState: {
    //       state: 'finished',
    //       did: options.did,
    //       didDocument:,
    //     },
    //   }
    // } catch (error) {
    //   agentContext.config.logger.error(`Error deactivating DID`, error)
      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: `unknownError`,
        },
      }
    // }
  }
}

export interface WebvhDidCreateWithoutDidDocumentOptions extends DidCreateOptions {
  method: 'webvh'
  did?: undefined
  didDocument?: undefined
  options?: {
    versionId?: string
  }
  secret: {
    verificationMethod: IVerificationMethod
  }
}

export interface WebvhDidCreateFromDidDocumentOptions extends DidCreateOptions {
  method: 'webvh'
  did?: undefined
  didDocument: DidDocument
  options?: {
    versionId?: string
  }
}

export type WebvhDidCreateOptions = WebvhDidCreateFromDidDocumentOptions | WebvhDidCreateWithoutDidDocumentOptions

export interface WebvhDidUpdateOptions extends DidUpdateOptions {
  did: string
  didDocument: DidDocument
  options?: {
    versionId?: string
  }
}

export interface WebvhDidDeactivateOptions extends DidCreateOptions {
  method: 'webvh'
  did: string
  options?: {
    versionId?: string
  }
}

interface IVerificationMethod {
  type: string
  id: string
  privateKeyMultibase?: string
  publicKeyMultibase: string
} 