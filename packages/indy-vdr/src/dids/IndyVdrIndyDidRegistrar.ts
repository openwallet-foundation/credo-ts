import type { CommEndpointType, IndyEndpointAttrib } from './didSovUtil'
import type { IndyVdrPool } from '../pool'
import type {
  AgentContext,
  DidRegistrar,
  DidCreateOptions,
  DidCreateResult,
  DidDeactivateResult,
  DidUpdateResult,
  DidDocument,
} from '@aries-framework/core'

import {
  TypedArrayEncoder,
  Key,
  KeyType,
  injectable,
  DidDocumentRole,
  DidRecord,
  DidRepository,
} from '@aries-framework/core'
import { AttribRequest, NymRequest } from 'indy-vdr-test-shared'

import { IndyVdrError } from '../error'
import { IndyVdrPoolService } from '../pool/IndyVdrPoolService'
import { DID_INDY_REGEX } from '../utils/did'

import { createKeyAgreementKey, indyDidDocumentFromDid } from './didIndyUtil'
import { addServicesFromEndpointsAttrib } from './didSovUtil'

export class IndyVdrSovDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['indy']

  public async create(agentContext: AgentContext, options: IndyVdrDidCreateOptions): Promise<DidCreateResult> {
    const { alias, role, submitterDid } = options.options
    const seed = options.secret?.seed

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

    const match = submitterDid.match(DID_INDY_REGEX)
    if (!match) {
      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: 'Submitter did must be a valid did:indy did',
        },
      }
    }

    const [, , namespace, submitterId] = match

    try {
      const key = await agentContext.wallet.createKey({ seed, keyType: KeyType.Ed25519 })

      const buffer = key.publicKey
      const id = TypedArrayEncoder.toBase58(buffer.slice(0, 16))

      const did = `did:indy:${namespace}:${id}`
      const verkey = key.publicKeyBase58

      const pool = agentContext.dependencyManager.resolve(IndyVdrPoolService).getPoolForNamespace(namespace)
      await this.registerPublicDid(agentContext, submitterId, id, verkey, pool, alias, role)

      // Create did document
      const didDocumentBuilder = indyDidDocumentFromDid(did, verkey)

      // Add services if endpoints object was passed.
      if (options.options.endpoints) {
        // For legacy indy-nodes not supporting diddocContent
        if (options.options.useEndpointAttrib) {
          await this.setEndpointsForDid(agentContext, id, options.options.endpoints, pool)

          // TODO: Move this logic to didIndyUtil, as it is common to Resolver and Registrar for legacy networks
          // If there is at least a didcomm endpoint, generate and a key agreement key
          const keyAgreementId = `${did}#key-agreement-1`
          const commTypes: CommEndpointType[] = ['endpoint', 'did-communication', 'DIDComm']
          if (commTypes.some((type) => options.options.endpoints?.types?.includes(type))) {
            didDocumentBuilder
              .addVerificationMethod({
                controller: did,
                id: keyAgreementId,
                publicKeyBase58: createKeyAgreementKey(did, verkey),
                type: 'X25519KeyAgreementKey2019',
              })
              .addKeyAgreement(keyAgreementId)
          }
          addServicesFromEndpointsAttrib(didDocumentBuilder, did, options.options.endpoints, keyAgreementId)
        } else {
          // TODO: create diddocContent parameter
        }
      }

      // Build did document
      const didDocument = didDocumentBuilder.build()

      // Save the did so we know we created it and can issue with it
      const didRecord = new DidRecord({
        id: did,
        did,
        role: DidDocumentRole.Created,
        tags: {
          recipientKeyFingerprints: didDocument.recipientKeys.map((key: Key) => key.fingerprint),
          did,
        },
      })

      const didRepository = agentContext.dependencyManager.resolve(DidRepository)
      await didRepository.save(agentContext, didRecord)

      return {
        didDocumentMetadata: {
          did,
        },
        didRegistrationMetadata: {
          namespace,
        },
        didState: {
          state: 'finished',
          did,
          didDocument,
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
        reason: `notImplemented: updating did:sov not implemented yet`,
      },
    }
  }

  public async deactivate(): Promise<DidDeactivateResult> {
    return {
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: `notImplemented: deactivating did:sov not implemented yet`,
      },
    }
  }

  public async registerPublicDid(
    agentContext: AgentContext,
    submitterDid: string,
    targetDid: string,
    verkey: string,
    pool: IndyVdrPool,
    alias?: string,
    role?: string
  ) {
    try {
      agentContext.config.logger.debug(`Register public did '${targetDid}' on ledger '${pool}'`)

      const request = new NymRequest({ submitterDid, dest: targetDid, verkey, alias })

      const signingKey = Key.fromPublicKeyBase58(submitterDid, KeyType.Ed25519)

      const response = await pool.submitWriteRequest(agentContext, request, signingKey)

      agentContext.config.logger.debug(`Registered public did '${targetDid}' on ledger '${pool.indyNamespace}'`, {
        response,
      })

      return targetDid
    } catch (error) {
      agentContext.config.logger.error(
        `Error registering public did '${targetDid}' on ledger '${pool.indyNamespace}'`,
        {
          error,
          submitterDid,
          targetDid,
          verkey,
          alias,
          role,
          pool: pool.indyNamespace,
        }
      )

      throw error
    }
  }

  public async setEndpointsForDid(
    agentContext: AgentContext,
    did: string,
    endpoints: IndyEndpointAttrib,
    pool: IndyVdrPool
  ): Promise<void> {
    try {
      agentContext.config.logger.debug(`Set endpoints for did '${did}' on ledger '${pool.indyNamespace}'`, endpoints)

      const request = new AttribRequest({
        submitterDid: did,
        targetDid: did,
        raw: JSON.stringify({ endpoint: endpoints }),
      })

      const signingKey = Key.fromPublicKeyBase58(did, KeyType.Ed25519)
      const response = await pool.submitWriteRequest(agentContext, request, signingKey)
      agentContext.config.logger.debug(
        `Successfully set endpoints for did '${did}' on ledger '${pool.indyNamespace}'`,
        {
          response,
          endpoints,
        }
      )
    } catch (error) {
      agentContext.config.logger.error(`Error setting endpoints for did '${did}' on ledger '${pool.indyNamespace}'`, {
        error,
        did,
        endpoints,
      })

      throw new IndyVdrError(error)
    }
  }
}

export interface IndyVdrDidCreateOptions extends DidCreateOptions {
  method: 'indy'
  did?: undefined
  didDocument?: DidDocument
  options: {
    alias?: string
    role?: string
    endpoints?: IndyEndpointAttrib
    useEndpointAttrib?: boolean
    indyNamespace?: string
    submitterDid: string
  }
  secret?: {
    seed?: string
  }
}

// TODO: Add Update and Deactivate
export type IndyVdrIndyDidUpdateOptions = never
export type IndyVdrIndyDidDeactivateOptions = never
