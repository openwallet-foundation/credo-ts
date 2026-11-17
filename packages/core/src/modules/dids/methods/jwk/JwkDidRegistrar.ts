import type { AgentContext } from '../../../../agent'
import type { XOR } from '../../../../types'
import {
  KeyManagementApi,
  type KmsCreateKeyOptions,
  type KmsCreateKeyTypeAsymmetric,
  type KmsJwkPublicAsymmetric,
  type KmsKeyReference,
  PublicJwk,
  type WithCreateKeyBackend,
} from '../../../kms'

import { DidDocumentRole } from '../../domain/DidDocumentRole'
import { type DidRegistrar, deleteDidKeys } from '../../domain/DidRegistrar'
import { DidRecord, DidRepository } from '../../repository'
import type { DidCreateOptions, DidCreateResult, DidDeactivateOptions, DidUpdateResult } from '../../types'
import { DidJwk } from './DidJwk'

export class JwkDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['jwk']
  public readonly deactivationSupport = 'notSupportedByMethod'

  public async create(agentContext: AgentContext, options: JwkDidCreateOptions): Promise<DidCreateResult> {
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)
    const kms = agentContext.dependencyManager.resolve(KeyManagementApi)
    let createdKey: KmsKeyReference | undefined

    try {
      let publicJwk: KmsJwkPublicAsymmetric
      let keyId: string
      let kmsBackend: string

      if (options.options.createKey) {
        const createKeyResult = await kms.createKey(options.options.createKey)
        publicJwk = createKeyResult.publicJwk
        keyId = createKeyResult.keyId
        kmsBackend = createKeyResult.backend
        createdKey = { keyId, kmsBackend }
      } else if (options.options.keyId) {
        const { publicKey: _publicJwk, backend } = await kms.getPublicKey({ keyId: options.options.keyId })
        keyId = options.options.keyId
        kmsBackend = backend
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

        if (_publicJwk.kty === 'oct') {
          return {
            didDocumentMetadata: {},
            didRegistrationMetadata: {},
            didState: {
              state: 'failed',
              reason: `notFound: key with key id '${options.options.keyId}' uses unsupported kty 'oct' for did:jwk`,
            },
          }
        }

        publicJwk = _publicJwk
      } else {
        return {
          didDocumentMetadata: {},
          didRegistrationMetadata: {},
          didState: {
            state: 'failed',
            reason: 'Missing keyId or createKey',
          },
        }
      }

      const didJwk = DidJwk.fromPublicJwk(PublicJwk.fromPublicJwk(publicJwk))

      // Save the did so we know we created it and can issue with it
      const didRecord = new DidRecord({
        did: didJwk.did,
        role: DidDocumentRole.Created,
        keys: [
          {
            didDocumentRelativeKeyId: '#0',
            kmsKeyId: keyId,
            kmsBackend,
          },
        ],
      })
      await didRepository.save(agentContext, didRecord)

      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'finished',
          did: didJwk.did,
          didDocument: didJwk.didDocument,
        },
      }
    } catch (error) {
      if (createdKey) await deleteDidKeys(agentContext, [createdKey], 'after failed did:jwk creation')
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

  public async update(): Promise<DidUpdateResult> {
    return {
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: 'notSupported: cannot update did:jwk did',
      },
    }
  }
}

export interface JwkDidCreateOptions extends DidCreateOptions {
  method: 'jwk'
  // For now we don't support creating a did:jwk with a did or did document
  did?: never
  didDocument?: never
  secret?: never

  /**
   * You can create a did:jwk based on an existing `keyId`, or provide `createKey` options
   * to create a new key.
   */
  options: XOR<{ createKey: WithCreateKeyBackend<KmsCreateKeyOptions<KmsCreateKeyTypeAsymmetric>> }, { keyId: string }>
}

// Update not supported for did:jwk
export type JwkDidUpdateOptions = never
export type JwkDidDeactivateOptions = DidDeactivateOptions
