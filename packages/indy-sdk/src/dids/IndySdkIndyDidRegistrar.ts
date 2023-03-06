import type { IndyEndpointAttrib } from './didSovUtil'
import type { IndySdkPool } from '../ledger'
import type { IndySdk } from '../types'
import type {
  AgentContext,
  Buffer,
  DidCreateOptions,
  DidCreateResult,
  DidDeactivateResult,
  DidRegistrar,
  DidUpdateResult,
} from '@aries-framework/core'
import type { NymRole } from 'indy-sdk'

import { DidDocumentRole, DidRecord, DidRepository, KeyType, Key } from '@aries-framework/core'

import { IndySdkError } from '../error'
import { isIndyError } from '../error/indyError'
import { IndySdkPoolService } from '../ledger'
import { IndySdkSymbol } from '../types'
import { assertIndySdkWallet } from '../utils/assertIndySdkWallet'
import { isLegacySelfCertifiedDid, legacyIndyDidFromPublicKeyBase58 } from '../utils/did'

import { createKeyAgreementKey, indyDidDocumentFromDid, parseIndyDid, verificationKeyForIndyDid } from './didIndyUtil'
import { addServicesFromEndpointsAttrib } from './didSovUtil'

export class IndySdkIndyDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['indy']

  public async create(agentContext: AgentContext, options: IndySdkIndyDidCreateOptions): Promise<DidCreateResult> {
    const indySdkPoolService = agentContext.dependencyManager.resolve(IndySdkPoolService)
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)

    const { alias, role, submitterDid, endpoints } = options.options
    let did = options.did
    let namespaceIdentifier: string
    let verificationKey: Key
    const privateKey = options.secret?.privateKey

    if (did && privateKey) {
      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: `Only one of 'privateKey' or 'did' must be provided`,
        },
      }
    }

    try {
      assertIndySdkWallet(agentContext.wallet)

      // Parse submitterDid and extract namespace based on the submitter did
      const { namespace: submitterNamespace, namespaceIdentifier: submitterNamespaceIdentifier } =
        parseIndyDid(submitterDid)
      const submitterSigningKey = await verificationKeyForIndyDid(agentContext, submitterDid)

      // Only supports version 1 did identifier (which is same as did:sov)
      if (did) {
        if (!options.options.verkey) {
          return {
            didDocumentMetadata: {},
            didRegistrationMetadata: {},
            didState: {
              state: 'failed',
              reason: 'If a did is defined, a matching verkey must be provided',
            },
          }
        }

        const { namespace, namespaceIdentifier: _namespaceIdentifier } = parseIndyDid(did)
        namespaceIdentifier = _namespaceIdentifier

        verificationKey = Key.fromPublicKeyBase58(options.options.verkey, KeyType.Ed25519)

        if (!isLegacySelfCertifiedDid(namespaceIdentifier, options.options.verkey)) {
          return {
            didDocumentMetadata: {},
            didRegistrationMetadata: {},
            didState: {
              state: 'failed',
              reason: `Did must be first 16 bytes of the the verkey base58 encoded.`,
            },
          }
        }

        if (submitterNamespace !== namespace) {
          return {
            didDocumentMetadata: {},
            didRegistrationMetadata: {},
            didState: {
              state: 'failed',
              reason: `The submitter did uses namespace ${submitterNamespace} and the did to register uses namespace ${namespace}. Namespaces must match.`,
            },
          }
        }
      } else {
        // Create a new key and calculate did according to the rules for indy did method
        verificationKey = await agentContext.wallet.createKey({ privateKey, keyType: KeyType.Ed25519 })
        namespaceIdentifier = legacyIndyDidFromPublicKeyBase58(verificationKey.publicKeyBase58)
        did = `did:indy:${submitterNamespace}:${namespaceIdentifier}`
      }

      const pool = indySdkPoolService.getPoolForNamespace(submitterNamespace)
      await this.registerPublicDid(
        agentContext,
        pool,
        submitterNamespaceIdentifier,
        submitterSigningKey,
        namespaceIdentifier,
        verificationKey,
        alias,
        role
      )

      // Create did document
      const didDocumentBuilder = indyDidDocumentFromDid(did, verificationKey.publicKeyBase58)

      // Add services if endpoints object was passed.
      if (endpoints) {
        const keyAgreementId = `${did}#key-agreement-1`

        await this.setEndpointsForDid(agentContext, pool, namespaceIdentifier, verificationKey, endpoints)

        didDocumentBuilder
          .addContext('https://w3id.org/security/suites/x25519-2019/v1')
          .addVerificationMethod({
            controller: did,
            id: keyAgreementId,
            publicKeyBase58: createKeyAgreementKey(verificationKey.publicKeyBase58),
            type: 'X25519KeyAgreementKey2019',
          })
          .addKeyAgreement(keyAgreementId)

        // Process endpoint attrib following the same rules as for did:sov
        addServicesFromEndpointsAttrib(didDocumentBuilder, did, endpoints, keyAgreementId)
      }

      // Build did document.
      const didDocument = didDocumentBuilder.build()

      // Save the did so we know we created it and can issue with it
      const didRecord = new DidRecord({
        did,
        role: DidDocumentRole.Created,
        tags: {
          recipientKeyFingerprints: didDocument.recipientKeys.map((key: Key) => key.fingerprint),
        },
      })
      await didRepository.save(agentContext, didRecord)

      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
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
        reason: `notImplemented: updating did:indy not implemented yet`,
      },
    }
  }

  public async deactivate(): Promise<DidDeactivateResult> {
    return {
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason: `notImplemented: deactivating did:indy not implemented yet`,
      },
    }
  }

  private async registerPublicDid(
    agentContext: AgentContext,
    pool: IndySdkPool,
    unqualifiedSubmitterDid: string,
    submitterSigningKey: Key,
    unqualifiedDid: string,
    signingKey: Key,
    alias: string,
    role?: NymRole
  ) {
    const indySdk = agentContext.dependencyManager.resolve<IndySdk>(IndySdkSymbol)
    const indySdkPoolService = agentContext.dependencyManager.resolve(IndySdkPoolService)

    try {
      agentContext.config.logger.debug(`Register public did '${unqualifiedDid}' on ledger '${pool.didIndyNamespace}'`)

      const request = await indySdk.buildNymRequest(
        unqualifiedSubmitterDid,
        unqualifiedDid,
        signingKey.publicKeyBase58,
        alias,
        role || null
      )

      const response = await indySdkPoolService.submitWriteRequest(agentContext, pool, request, submitterSigningKey)

      agentContext.config.logger.debug(
        `Registered public did '${unqualifiedDid}' on ledger '${pool.didIndyNamespace}'`,
        {
          response,
        }
      )
    } catch (error) {
      agentContext.config.logger.error(
        `Error registering public did '${unqualifiedDid}' on ledger '${pool.didIndyNamespace}'`,
        {
          error,
          unqualifiedSubmitterDid,
          unqualifiedDid,
          verkey: signingKey.publicKeyBase58,
          alias,
          role,
          pool: pool.didIndyNamespace,
        }
      )

      throw error
    }
  }

  private async setEndpointsForDid(
    agentContext: AgentContext,
    pool: IndySdkPool,
    unqualifiedDid: string,
    signingKey: Key,
    endpoints: IndyEndpointAttrib
  ): Promise<void> {
    const indySdk = agentContext.dependencyManager.resolve<IndySdk>(IndySdkSymbol)
    const indySdkPoolService = agentContext.dependencyManager.resolve(IndySdkPoolService)

    try {
      agentContext.config.logger.debug(
        `Set endpoints for did '${unqualifiedDid}' on ledger '${pool.didIndyNamespace}'`,
        endpoints
      )

      const request = await indySdk.buildAttribRequest(
        unqualifiedDid,
        unqualifiedDid,
        null,
        { endpoint: endpoints },
        null
      )

      const response = await indySdkPoolService.submitWriteRequest(agentContext, pool, request, signingKey)
      agentContext.config.logger.debug(
        `Successfully set endpoints for did '${unqualifiedDid}' on ledger '${pool.didIndyNamespace}'`,
        {
          response,
          endpoints,
        }
      )
    } catch (error) {
      agentContext.config.logger.error(
        `Error setting endpoints for did '${unqualifiedDid}' on ledger '${pool.didIndyNamespace}'`,
        {
          error,
          unqualifiedDid,
          endpoints,
        }
      )

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }
}

interface IndySdkIndyDidCreateOptionsBase extends DidCreateOptions {
  // The indy sdk can only publish a very limited did document (what is mostly known as a legacy did:sov did) and thus we require everything
  // needed to construct the did document to be passed through the options object.
  didDocument?: never
  options: {
    alias: string
    role?: NymRole
    verkey?: string
    endpoints?: IndyEndpointAttrib
    submitterDid: string
  }
  secret?: {
    privateKey?: Buffer
  }
}

interface IndySdkIndyDidCreateOptionsWithDid extends IndySdkIndyDidCreateOptionsBase {
  method?: never
  did: string
}

interface IndySdkIndyDidCreateOptionsWithoutDid extends IndySdkIndyDidCreateOptionsBase {
  method: 'indy'
  did?: never
}

export type IndySdkIndyDidCreateOptions = IndySdkIndyDidCreateOptionsWithDid | IndySdkIndyDidCreateOptionsWithoutDid
