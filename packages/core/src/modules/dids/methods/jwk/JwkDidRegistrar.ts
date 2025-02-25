import type { AgentContext } from '../../../../agent'
import type { Key, KeyType } from '../../../../crypto'
import type { Buffer } from '../../../../utils'
import type { DidRegistrar } from '../../domain/DidRegistrar'
import type { DidCreateOptions, DidCreateResult, DidDeactivateResult, DidUpdateResult } from '../../types'

import { getJwkFromKey } from '../../../../crypto/jose/jwk'
import { DidDocumentRole } from '../../domain/DidDocumentRole'
import { DidRecord, DidRepository } from '../../repository'

import { DidJwk } from './DidJwk'

export class JwkDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['jwk']

  public async create(agentContext: AgentContext, options: JwkDidCreateOptions): Promise<DidCreateResult> {
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)

    const keyType = options.options.keyType
    const seed = options.secret?.seed
    const privateKey = options.secret?.privateKey

    try {
      let key = options.options.key

      if (key && (keyType || seed || privateKey)) {
        return {
          didDocumentMetadata: {},
          didRegistrationMetadata: {},
          didState: {
            state: 'failed',
            reason: 'Key instance cannot be combined with key type, seed or private key',
          },
        }
      }

      if (keyType) {
        key = await agentContext.wallet.createKey({
          keyType,
          seed,
          privateKey,
        })
      }

      if (!key) {
        return {
          didDocumentMetadata: {},
          didRegistrationMetadata: {},
          didState: {
            state: 'failed',
            reason: 'Missing key type or key instance',
          },
        }
      }

      const jwk = getJwkFromKey(key)
      const didJwk = DidJwk.fromJwk(jwk)

      // Save the did so we know we created it and can issue with it
      const didRecord = new DidRecord({
        did: didJwk.did,
        role: DidDocumentRole.Created,
      })
      await didRepository.save(agentContext, didRecord)

      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'finished',
          did: didJwk.did,
          didDocument: didJwk.didDocument,
          secret: {
            // FIXME: the uni-registrar creates the seed in the registrar method
            // if it doesn't exist so the seed can always be returned. Currently
            // we can only return it if the seed was passed in by the user. Once
            // we have a secure method for generating seeds we should use the same
            // approach
            seed: options.secret?.seed,
            privateKey: options.secret?.privateKey,
          },
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
        reason: 'notSupported: cannot update did:jwk did',
      },
    }
  }

  public async deactivate(): Promise<DidDeactivateResult> {
    return {
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: 'notSupported: cannot deactivate did:jwk did',
      },
    }
  }
}

export interface JwkDidCreateOptions extends DidCreateOptions {
  method: 'jwk'
  // For now we don't support creating a did:jwk with a did or did document
  did?: never
  didDocument?: never
  options: {
    keyType?: KeyType
    key?: Key
  }
  secret?: {
    seed?: Buffer
    privateKey?: Buffer
  }
}

// Update and Deactivate not supported for did:jwk
export type JwkDidUpdateOptions = never
export type JwkDidDeactivateOptions = never
