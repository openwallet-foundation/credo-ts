import type { AgentContext } from '../../../../agent'
import type { Key, KeyType } from '../../../../crypto'
import type { Buffer } from '../../../../utils'
import type { DidRegistrar } from '../../domain/DidRegistrar'
import type { DidCreateOptions, DidCreateResult, DidDeactivateResult, DidUpdateResult } from '../../types'

import { JsonTransformer } from '../../../../utils'
import { DidDocument } from '../../domain'
import { DidDocumentRole } from '../../domain/DidDocumentRole'
import { DidRecord, DidRepository } from '../../repository'

import { PeerDidNumAlgo, getAlternativeDidsForPeerDid } from './didPeer'
import { keyToNumAlgo0DidDocument } from './peerDidNumAlgo0'
import { didDocumentJsonToNumAlgo1Did } from './peerDidNumAlgo1'
import { didDocumentToNumAlgo2Did } from './peerDidNumAlgo2'
import { didDocumentToNumAlgo4Did } from './peerDidNumAlgo4'

export class PeerDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['peer']

  public async create(
    agentContext: AgentContext,
    options:
      | PeerDidNumAlgo0CreateOptions
      | PeerDidNumAlgo1CreateOptions
      | PeerDidNumAlgo2CreateOptions
      | PeerDidNumAlgo4CreateOptions
  ): Promise<DidCreateResult> {
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)

    let did: string
    let didDocument: DidDocument

    try {
      if (isPeerDidNumAlgo0CreateOptions(options)) {
        const keyType = options.options.keyType
        const seed = options.secret?.seed
        const privateKey = options.secret?.privateKey

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

        // TODO: validate did:peer document

        didDocument = keyToNumAlgo0DidDocument(key)
        did = didDocument.id
      } else if (isPeerDidNumAlgo1CreateOptions(options)) {
        const didDocumentJson = options.didDocument.toJSON()
        did = didDocumentJsonToNumAlgo1Did(didDocumentJson)

        didDocument = JsonTransformer.fromJSON({ ...didDocumentJson, id: did }, DidDocument)
      } else if (isPeerDidNumAlgo2CreateOptions(options)) {
        const didDocumentJson = options.didDocument.toJSON()
        did = didDocumentToNumAlgo2Did(options.didDocument)

        didDocument = JsonTransformer.fromJSON({ ...didDocumentJson, id: did }, DidDocument)
      } else if (isPeerDidNumAlgo4CreateOptions(options)) {
        const didDocumentJson = options.didDocument.toJSON()

        const { longFormDid, shortFormDid } = didDocumentToNumAlgo4Did(options.didDocument)

        did = longFormDid
        didDocument = JsonTransformer.fromJSON(
          { ...didDocumentJson, id: longFormDid, alsoKnownAs: [shortFormDid] },
          DidDocument
        )
      } else {
        return {
          didDocumentMetadata: {},
          didRegistrationMetadata: {},
          didState: {
            state: 'failed',
            reason: 'Missing or incorrect numAlgo provided',
          },
        }
      }

      // Save the did so we know we created it and can use it for didcomm
      const didRecord = new DidRecord({
        did,
        role: DidDocumentRole.Created,
        didDocument: isPeerDidNumAlgo1CreateOptions(options) ? didDocument : undefined,
        tags: {
          // We need to save the recipientKeys, so we can find the associated did
          // of a key when we receive a message from another connection.
          recipientKeyFingerprints: didDocument.recipientKeys.map((key) => key.fingerprint),
          alternativeDids: getAlternativeDidsForPeerDid(did),
        },
      })
      await didRepository.save(agentContext, didRecord)

      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'finished',
          did: didDocument.id,
          didDocument,
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
          reason: `unknown error: ${error.message}`,
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
        reason: 'notImplemented: updating did:peer not implemented yet',
      },
    }
  }

  public async deactivate(): Promise<DidDeactivateResult> {
    return {
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: 'notImplemented: deactivating did:peer not implemented yet',
      },
    }
  }
}

function isPeerDidNumAlgo1CreateOptions(options: PeerDidCreateOptions): options is PeerDidNumAlgo1CreateOptions {
  return options.options.numAlgo === PeerDidNumAlgo.GenesisDoc
}

function isPeerDidNumAlgo0CreateOptions(options: PeerDidCreateOptions): options is PeerDidNumAlgo0CreateOptions {
  return options.options.numAlgo === PeerDidNumAlgo.InceptionKeyWithoutDoc
}

function isPeerDidNumAlgo2CreateOptions(options: PeerDidCreateOptions): options is PeerDidNumAlgo2CreateOptions {
  return options.options.numAlgo === PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc
}

function isPeerDidNumAlgo4CreateOptions(options: PeerDidCreateOptions): options is PeerDidNumAlgo4CreateOptions {
  return options.options.numAlgo === PeerDidNumAlgo.ShortFormAndLongForm
}

export type PeerDidCreateOptions =
  | PeerDidNumAlgo0CreateOptions
  | PeerDidNumAlgo1CreateOptions
  | PeerDidNumAlgo2CreateOptions
  | PeerDidNumAlgo4CreateOptions

export interface PeerDidNumAlgo0CreateOptions extends DidCreateOptions {
  method: 'peer'
  did?: never
  didDocument?: never
  options: {
    keyType?: KeyType
    key?: Key
    numAlgo: PeerDidNumAlgo.InceptionKeyWithoutDoc
  }
  secret?: {
    seed?: Buffer
    privateKey?: Buffer
  }
}

export interface PeerDidNumAlgo1CreateOptions extends DidCreateOptions {
  method: 'peer'
  did?: never
  didDocument: DidDocument
  options: {
    numAlgo: PeerDidNumAlgo.GenesisDoc
  }
  secret?: undefined
}

export interface PeerDidNumAlgo2CreateOptions extends DidCreateOptions {
  method: 'peer'
  did?: never
  didDocument: DidDocument
  options: {
    numAlgo: PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc
  }
  secret?: undefined
}

export interface PeerDidNumAlgo4CreateOptions extends DidCreateOptions {
  method: 'peer'
  did?: never
  didDocument: DidDocument
  options: {
    numAlgo: PeerDidNumAlgo.ShortFormAndLongForm
  }
  secret?: undefined
}

// Update and Deactivate not supported for did:peer
export type PeerDidUpdateOptions = never
export type PeerDidDeactivateOptions = never
