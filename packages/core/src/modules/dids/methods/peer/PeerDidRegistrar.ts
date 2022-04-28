import type { KeyType } from '../../../../crypto'
import type { Wallet } from '../../../../wallet/Wallet'
import type { DidDocument } from '../../domain'
import type { DidRegistrar } from '../../domain/DidRegistrar'
import type { DidRepository } from '../../repository'
import type { DidCreateOptions, DidCreateResult, DidDeactivateResult, DidUpdateResult } from '../../types'

import { DidDocumentRole } from '../../domain/DidDocumentRole'
import { DidRecord } from '../../repository'

import { DidPeer, PeerDidNumAlgo } from './DidPeer'

export class PeerDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['peer']
  private wallet: Wallet
  private didRepository: DidRepository

  public constructor(wallet: Wallet, didRepository: DidRepository) {
    this.wallet = wallet
    this.didRepository = didRepository
  }

  public async create(
    options: PeerDidNumAlgo0CreateOptions | PeerDidNumAlgo1CreateOptions | PeerDidNumAlgo2CreateOptions
  ): Promise<DidCreateResult> {
    let didPeer: DidPeer

    try {
      if (isPeerDidNumAlgo0CreateOptions(options)) {
        const keyType = options.options.keyType
        const seed = options.secret?.seed

        if (!keyType) {
          return {
            didDocumentMetadata: {},
            didRegistrationMetadata: {},
            didState: {
              state: 'failed',
              reason: 'Missing key type',
            },
          }
        }

        if (seed && (typeof seed !== 'string' || seed.length !== 32)) {
          return {
            didDocumentMetadata: {},
            didRegistrationMetadata: {},
            didState: {
              state: 'failed',
              reason: 'Invalid seed provided',
            },
          }
        }

        const key = await this.wallet.createKey({
          keyType,
          seed,
        })

        didPeer = DidPeer.fromKey(key)
      } else if (isPeerDidNumAlgo1CreateOptions(options)) {
        // FIXME: update all id references to the did (allow to retrieve both stored and resolved variant)
        didPeer = DidPeer.fromDidDocument(options.didDocument, PeerDidNumAlgo.GenesisDoc)
      } else if (isPeerDidNumAlgo2CreateOptions(options)) {
        didPeer = DidPeer.fromDidDocument(options.didDocument, PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc)
      } else {
        return {
          didDocumentMetadata: {},
          didRegistrationMetadata: {},
          didState: {
            state: 'failed',
            reason: `Missing or incorrect numAlgo provided`,
          },
        }
      }

      // Save the did so we know we created it and can use it for didcomm
      const didRecord = new DidRecord({
        id: didPeer.did,
        role: DidDocumentRole.Created,
        didDocument: didPeer.numAlgo === PeerDidNumAlgo.GenesisDoc ? didPeer.didDocument : undefined,
        tags: {
          // We need to save the recipientKeys, so we can find the associated did
          // of a key when we receive a message from another connection.
          recipientKeys: didPeer.didDocument.recipientKeys,
        },
      })
      await this.didRepository.save(didRecord)

      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'finished',
          did: didPeer.did,
          didDocument: didPeer.didDocument,
          secret: {
            // FIXME: the uni-registrar creates the seed in the registrar method
            // if it doesn't exist so the seed can always be returned. Currently
            // we can only return it if the seed was passed in by the user. Once
            // we have a secure method for generating seeds we should use the same
            // approach
            seed: options.secret?.seed,
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
        reason: `notSupported: cannot update did:peer did`,
      },
    }
  }

  public async deactivate(): Promise<DidDeactivateResult> {
    return {
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: `notSupported: cannot deactivate did:peer did`,
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

export type PeerDidCreateOptions =
  | PeerDidNumAlgo0CreateOptions
  | PeerDidNumAlgo1CreateOptions
  | PeerDidNumAlgo2CreateOptions

export interface PeerDidNumAlgo0CreateOptions extends DidCreateOptions {
  method: 'peer'
  did?: never
  didDocument?: never
  options: {
    keyType: KeyType.Ed25519
    numAlgo: PeerDidNumAlgo.InceptionKeyWithoutDoc
  }
  secret?: {
    seed?: string
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
  did?: undefined
  didDocument: DidDocument
  options: {
    numAlgo: PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc
  }
  secret?: undefined
}

// Update and Deactivate not supported for did:peer
export type PeerDidUpdateOptions = never
export type PeerDidDeactivateOptions = never
