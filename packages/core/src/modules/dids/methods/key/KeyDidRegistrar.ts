import type { AgentContext } from '../../../../agent'
import type { DidRegistrar } from '../../domain/DidRegistrar'
import type { DidCreateOptions, DidCreateResult, DidDeactivateResult, DidUpdateResult } from '../../types'

import type { XOR } from '../../../../types'
import {
  KeyManagementApi,
  type KmsCreateKeyOptions,
  type KmsCreateKeyTypeAssymetric,
  type KmsJwkPublicAsymmetric,
  PublicJwk,
} from '../../../kms'
import { DidDocumentRole } from '../../domain/DidDocumentRole'
import { DidRecord, DidRepository } from '../../repository'
import { DidKey } from './DidKey'

export class KeyDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['key']

  public async create(agentContext: AgentContext, options: KeyDidCreateOptions): Promise<DidCreateResult> {
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)

    try {
      let publicJwk: KmsJwkPublicAsymmetric
      let keyId: string
      const kms = agentContext.dependencyManager.resolve(KeyManagementApi)

      if (options.options.createKey) {
        const createKeyResult = await kms.createKey(options.options.createKey)
        publicJwk = createKeyResult.publicJwk
        keyId = createKeyResult.keyId
      } else {
        const _publicJwk = await kms.getPublicKey({
          keyId: options.options.keyId,
        })
        keyId = options.options.keyId
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
              reason: `notFound: key with key id '${options.options.keyId}' uses unsupported kty 'oct' for did:key`,
            },
          }
        }

        publicJwk = _publicJwk
      }

      const jwk = PublicJwk.fromPublicJwk(publicJwk)
      const didKey = new DidKey(jwk)

      // Save the did so we know we created it and can issue with it
      const didRecord = new DidRecord({
        did: didKey.did,
        role: DidDocumentRole.Created,

        keys: [
          {
            didDocumentRelativeKeyId: `#${didKey.publicJwk.fingerprint}`,
            kmsKeyId: keyId,
          },
        ],
      })
      await didRepository.save(agentContext, didRecord)

      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'finished',
          did: didKey.did,
          didDocument: didKey.didDocument,
          secret: {},
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

  public async update(): Promise<DidUpdateResult> {
    return {
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: 'notSupported: cannot update did:key did',
      },
    }
  }

  public async deactivate(): Promise<DidDeactivateResult> {
    return {
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: 'notSupported: cannot deactivate did:key did',
      },
    }
  }
}

export interface KeyDidCreateOptions extends DidCreateOptions {
  method: 'key'
  // For now we don't support creating a did:key with a did or did document
  did?: never
  didDocument?: never
  secret?: never

  /**
   * You can create a did:key based on an existing `keyId`, or provide `createKey` options
   * to create a new key.
   */
  options: XOR<{ createKey: KmsCreateKeyOptions<KmsCreateKeyTypeAssymetric> }, { keyId: string }>
}

// Update and Deactivate not supported for did:key
export type KeyDidUpdateOptions = never
export type KeyDidDeactivateOptions = never
