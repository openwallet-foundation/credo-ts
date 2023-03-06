import type { IndyEndpointAttrib } from './didSovUtil'
import type { IndyVdrPool } from '../pool'
import type {
  AgentContext,
  Buffer,
  DidRegistrar,
  DidCreateOptions,
  DidCreateResult,
  DidDeactivateResult,
  DidUpdateResult,
  DidDocumentService,
} from '@aries-framework/core'

import {
  IndyAgentService,
  DidCommV1Service,
  DidCommV2Service,
  Hasher,
  TypedArrayEncoder,
  Key,
  KeyType,
  DidDocumentRole,
  DidRecord,
  DidRepository,
} from '@aries-framework/core'
import { AttribRequest, NymRequest } from '@hyperledger/indy-vdr-shared'

import { IndyVdrError } from '../error'
import { IndyVdrPoolService } from '../pool/IndyVdrPoolService'

import {
  createKeyAgreementKey,
  didDocDiff,
  indyDidDocumentFromDid,
  parseIndyDid,
  isSelfCertifiedIndyDid,
  verificationKeyForIndyDid,
} from './didIndyUtil'
import { endpointsAttribFromServices } from './didSovUtil'

export class IndyVdrIndyDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['indy']

  public async create(agentContext: AgentContext, options: IndyVdrDidCreateOptions): Promise<DidCreateResult> {
    const seed = options.secret?.seed
    const privateKey = options.secret?.privateKey

    const { alias, role, submitterDid, services, useEndpointAttrib } = options.options
    let did = options.did
    let namespaceIdentifier: string
    let verificationKey: Key

    const allowOne = [privateKey, seed, did].filter((e) => e !== undefined)
    if (allowOne.length > 1) {
      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: `Only one of 'seed', 'privateKey' and 'did' must be provided`,
        },
      }
    }

    try {
      // Parse submitterDid and extract namespace based on the submitter did
      const { namespace: submitterNamespace, namespaceIdentifier: submitterNamespaceIdentifier } =
        parseIndyDid(submitterDid)
      const submitterSigningKey = await verificationKeyForIndyDid(agentContext, submitterDid)

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

        if (!isSelfCertifiedIndyDid(did, options.options.verkey)) {
          return {
            didDocumentMetadata: {},
            didRegistrationMetadata: {},
            didState: {
              state: 'failed',
              reason: `Initial verkey ${options.options.verkey} does not match did ${did}`,
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
        verificationKey = await agentContext.wallet.createKey({ privateKey, seed, keyType: KeyType.Ed25519 })
        const buffer = Hasher.hash(verificationKey.publicKey, 'sha2-256')

        namespaceIdentifier = TypedArrayEncoder.toBase58(buffer.slice(0, 16))
        did = `did:indy:${submitterNamespace}:${namespaceIdentifier}`
      }

      // Create base did document
      const didDocumentBuilder = indyDidDocumentFromDid(did, verificationKey.publicKeyBase58)
      let diddocContent

      // Add services if object was passed
      if (services) {
        services.forEach((item) => {
          const prependDidIfNotPresent = (id: string) => {
            return id.startsWith('#') ? `${did}${id}` : id
          }

          // Prepend the did to the service id if it is not already there
          item.id = prependDidIfNotPresent(item.id)

          // TODO: should we also prepend the did to routingKeys?
          if (item instanceof DidCommV1Service) {
            item.recipientKeys = item.recipientKeys.map(prependDidIfNotPresent)
          }

          didDocumentBuilder.addService(item)
        })

        const commTypes = [IndyAgentService.type, DidCommV1Service.type, DidCommV2Service.type]
        const serviceTypes = new Set(services.map((item) => item.type))

        const keyAgreementId = `${did}#key-agreement-1`

        // If there is at least a communication service, add the key agreement key
        if (commTypes.some((type) => serviceTypes.has(type))) {
          didDocumentBuilder
            .addContext('https://w3id.org/security/suites/x25519-2019/v1')
            .addVerificationMethod({
              controller: did,
              id: keyAgreementId,
              publicKeyBase58: createKeyAgreementKey(verificationKey.publicKeyBase58),
              type: 'X25519KeyAgreementKey2019',
            })
            .addKeyAgreement(keyAgreementId)
        }

        // If there is a DIDComm V2 service, add context
        if (serviceTypes.has(DidCommV2Service.type)) {
          didDocumentBuilder.addContext('https://didcomm.org/messaging/contexts/v2')
        }

        if (!useEndpointAttrib) {
          // create diddocContent parameter based on the diff between the base and the resulting DID Document
          diddocContent = didDocDiff(
            didDocumentBuilder.build().toJSON(),
            indyDidDocumentFromDid(did, verificationKey.publicKeyBase58).build().toJSON()
          )
        }
      }

      // Build did document
      const didDocument = didDocumentBuilder.build()
      const pool = agentContext.dependencyManager.resolve(IndyVdrPoolService).getPoolForNamespace(submitterNamespace)
      // If there are services and we are using legacy indy endpoint attrib, make sure they are suitable before registering the DID
      if (services && useEndpointAttrib) {
        const endpoints = endpointsAttribFromServices(services)
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
        await this.setEndpointsForDid(agentContext, pool, namespaceIdentifier, verificationKey, endpoints)
      } else {
        await this.registerPublicDid(
          agentContext,
          pool,
          submitterNamespaceIdentifier,
          submitterSigningKey,
          namespaceIdentifier,
          verificationKey,
          alias,
          role,
          diddocContent
        )
      }

      // Save the did so we know we created it and can issue with it
      const didRecord = new DidRecord({
        did,
        role: DidDocumentRole.Created,
        tags: {
          recipientKeyFingerprints: didDocument.recipientKeys.map((key: Key) => key.fingerprint),
          qualifiedIndyDid: did,
        },
      })

      const didRepository = agentContext.dependencyManager.resolve(DidRepository)
      await didRepository.save(agentContext, didRecord)

      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {
          didIndyNamespace: submitterNamespace,
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
    pool: IndyVdrPool,
    unqualifiedSubmitterDid: string,
    submitterSigningKey: Key,
    unqualifiedDid: string,
    signingKey: Key,
    alias?: string,
    role?: string,
    diddocContent?: Record<string, unknown>
  ) {
    try {
      agentContext.config.logger.debug(`Register public did '${unqualifiedDid}' on ledger '${pool}'`)

      // FIXME: Add diddocContent when supported by indy-vdr
      if (diddocContent) {
        throw new IndyVdrError('diddocContent is not yet supported')
      }

      const request = new NymRequest({
        submitterDid: unqualifiedSubmitterDid,
        dest: unqualifiedDid,
        verkey: signingKey.publicKeyBase58,
        alias,
      })

      const response = await pool.submitWriteRequest(agentContext, request, submitterSigningKey)

      agentContext.config.logger.debug(`Registered public did '${unqualifiedDid}' on ledger '${pool.indyNamespace}'`, {
        response,
      })

      return
    } catch (error) {
      agentContext.config.logger.error(
        `Error registering public did '${unqualifiedDid}' on ledger '${pool.indyNamespace}'`,
        {
          error,
          unqualifiedSubmitterDid,
          unqualifiedDid,
          signingKey,
          alias,
          role,
          pool: pool.indyNamespace,
        }
      )

      throw error
    }
  }

  private async setEndpointsForDid(
    agentContext: AgentContext,
    pool: IndyVdrPool,
    unqualifiedDid: string,
    signingKey: Key,
    endpoints: IndyEndpointAttrib
  ): Promise<void> {
    try {
      agentContext.config.logger.debug(
        `Set endpoints for did '${unqualifiedDid}' on ledger '${pool.indyNamespace}'`,
        endpoints
      )

      const request = new AttribRequest({
        submitterDid: unqualifiedDid,
        targetDid: unqualifiedDid,
        raw: JSON.stringify({ endpoint: endpoints }),
      })

      const response = await pool.submitWriteRequest(agentContext, request, signingKey)
      agentContext.config.logger.debug(
        `Successfully set endpoints for did '${unqualifiedDid}' on ledger '${pool.indyNamespace}'`,
        {
          response,
          endpoints,
        }
      )
    } catch (error) {
      agentContext.config.logger.error(
        `Error setting endpoints for did '${unqualifiedDid}' on ledger '${pool.indyNamespace}'`,
        {
          error,
          unqualifiedDid,
          endpoints,
        }
      )

      throw new IndyVdrError(error)
    }
  }
}

interface IndyVdrDidCreateOptionsBase extends DidCreateOptions {
  didDocument?: never // Not yet supported
  options: {
    alias?: string
    role?: string
    services?: DidDocumentService[]
    useEndpointAttrib?: boolean
    verkey?: string

    submitterDid: string
  }
  secret?: {
    seed?: Buffer
    privateKey?: Buffer
  }
}

interface IndyVdrDidCreateOptionsWithDid extends IndyVdrDidCreateOptionsBase {
  method?: never
  did: string
}

interface IndyVdrDidCreateOptionsWithoutDid extends IndyVdrDidCreateOptionsBase {
  method: 'indy'
  did?: never
}

export type IndyVdrDidCreateOptions = IndyVdrDidCreateOptionsWithDid | IndyVdrDidCreateOptionsWithoutDid
