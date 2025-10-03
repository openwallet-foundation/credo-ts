import type {
  AgentContext,
  DidCreateOptions,
  DidCreateResult,
  DidDeactivateOptions,
  DidDeactivateResult,
  DidDocumentKey,
  DidRegistrar,
  DidUpdateOptions,
  DidUpdateResult,
  VerificationMethod,
} from '@credo-ts/core'

import { DidDocument, DidDocumentRole, DidRecord, DidRepository, JsonTransformer, Kms } from '@credo-ts/core'
import { type DIDLog, MultibaseEncoding, createDID, multibaseEncode, updateDID } from 'didwebvh-ts'

import { WebvhDidCrypto } from './WebvhDidCrypto'
import { WebvhDidCryptoSigner } from './WebvhDidCryptoSigner'

interface WebVhDidCreateOptions extends DidCreateOptions {
  domain: string
  path?: string
}

interface WebVhDidUpdateOptions extends DidUpdateOptions {
  didDocument: DidDocument
}

const normalizeMethodArray = (arr?: (string | { id: string })[]) =>
  arr?.map((item) => (typeof item === 'string' ? item : item.id))

/**
 * DID Registrar implementation for the 'webvh' method.
 * Handles creation, update, and (future) deactivation of DIDs using the webvh method.
 */
export class WebVhDidRegistrar implements DidRegistrar {
  public readonly supportedMethods: string[] = ['webvh']

  /**
   * Creates a new DID document and saves it in the repository.
   * Handles crypto setup, DID generation, and persistence.
   * The `paths` option (string with `/` or array of segments) allows adding sub-identifiers
   * after the domain, joined with `:` in the resulting DID.
   * @param agentContext The agent context.
   * @param options The creation options, including domain, optional paths, endpoints, controller, signer, and verifier.
   * @returns The result of the DID creation, with error handling.
   */
  public async create(agentContext: AgentContext, options: WebVhDidCreateOptions): Promise<DidCreateResult> {
    try {
      const { domain, path } = options
      const paths = path?.replace(/^\/|\/$/g, '').split('/')
      const domainKey = paths?.length ? [domain, ...paths].join(':') : domain
      const keys: DidDocumentKey[] = []
      const didRepository = agentContext.dependencyManager.resolve(DidRepository)
      const record = await didRepository.findSingleByQuery(agentContext, {
        role: DidDocumentRole.Created,
        domain: domainKey,
        method: 'webvh',
      })
      if (record) return this.handleError(`A record with domain "${domain}" already exists.`)

      // Create crypto instance
      const { publicKeyMultibase, keyId } = await this.generatePublicKey(agentContext)
      const signer = new WebvhDidCryptoSigner(agentContext, publicKeyMultibase, keyId)
      const verifier = new WebvhDidCrypto(agentContext)
      const baseDid = `did:webvh:{SCID}:${domain}`

      // Create DID
      const { did, doc, log } = await createDID({
        domain,
        paths,
        signer,
        updateKeys: [publicKeyMultibase],
        verificationMethods: [
          {
            controller: baseDid,
            type: 'Multikey',
            publicKeyMultibase,
          },
        ],
        verifier,
      })

      const didDocument = JsonTransformer.fromJSON(doc, DidDocument)

      keys.push({
        kmsKeyId: keyId,
        didDocumentRelativeKeyId: `#${publicKeyMultibase}`,
      })
      const didRecord = new DidRecord({
        did,
        didDocument,
        role: DidDocumentRole.Created,
        keys,
      })
      didRecord.metadata.set('log', log)
      didRecord.setTags({ domain: domainKey })
      await didRepository.save(agentContext, didRecord)

      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'finished',
          did,
          didDocument,
        },
      }
    } catch (error) {
      return this.handleError(error instanceof Error ? error.message : 'Unknown error occurred.')
    }
  }

  /**
   * Updates an existing DID document and its log in the repository.
   * Uses internal logic to validate verification methods and handle errors.
   * @param agentContext The agent context.
   * @param options The update options, including DID, log, signer, verifier, and services.
   * @returns The result of the DID update, with error handling and validation.
   */
  public async update(agentContext: AgentContext, options: WebVhDidUpdateOptions): Promise<DidUpdateResult> {
    try {
      const { did, didDocument: inputDidDocument } = options
      const didRepository = agentContext.dependencyManager.resolve(DidRepository)
      const didRecord = await didRepository.findSingleByQuery(agentContext, {
        role: DidDocumentRole.Created,
        did,
        method: 'webvh',
      })
      if (!didRecord) return this.handleError('DID not found')

      const log = didRecord.metadata.get('log') as DIDLog
      const domain = didRecord.getTag('domain') as string
      const keyId = didRecord.keys?.[0].kmsKeyId

      if (!log) return this.handleError('The log registry must be created before it can be edited.')
      if (!keyId) return this.handleError('The key ID must be present before the log can be edited.')

      const {
        controller,
        authentication,
        assertionMethod,
        keyAgreement,
        service: services,
        verificationMethod: inputVerificationMethod,
      } = inputDidDocument
      const verificationMethods =
        inputVerificationMethod ?? (log[log.length - 1].state.verificationMethod as VerificationMethod[])
      const { updateKeys } = log[log.length - 1].parameters
      const verificationMethod = verificationMethods?.find((vm) => vm.publicKeyMultibase)
      if (!verificationMethod?.publicKeyMultibase)
        return this.handleError('At least one verification method with publicKeyMultibase must be provided.')

      // Get signer/verifier
      const signer = new WebvhDidCryptoSigner(agentContext, verificationMethod.publicKeyMultibase, keyId)
      const verifier = new WebvhDidCrypto(agentContext)

      const { log: logResult, doc } = await updateDID({
        log,
        signer,
        verifier,
        domain,
        updateKeys,
        ...inputDidDocument,
        verificationMethods: verificationMethods.map((vm) => ({
          ...vm,
          publicKeyMultibase: vm.publicKeyMultibase ?? '',
        })),
        controller: Array.isArray(controller) ? controller[0] : controller,
        authentication: normalizeMethodArray(authentication),
        assertionMethod: normalizeMethodArray(assertionMethod),
        keyAgreement: normalizeMethodArray(keyAgreement),
        services,
      })
      didRecord.metadata.set('log', logResult)
      didRecord.didDocument = JsonTransformer.fromJSON(doc, DidDocument)
      await didRepository.update(agentContext, didRecord)

      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'finished',
          did,
          didDocument: didRecord.didDocument,
        },
      }
    } catch (error) {
      return this.handleError(error instanceof Error ? error.message : 'Unknown error occurred.')
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public deactivate(_agentContext: AgentContext, _options: DidDeactivateOptions): Promise<DidDeactivateResult> {
    throw new Error('Method not implemented.')
  }

  /**
   * Generates a new Ed25519 public key in multibase format and stores the private key in the wallet.
   * @param agentContext The agent context.
   * @returns The public key in multibase format.
   */
  private async generatePublicKey(agentContext: AgentContext): Promise<{ publicKeyMultibase: string; keyId: string }> {
    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
    const key = await kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
    const publicKeyBytes = Kms.PublicJwk.fromPublicJwk(key.publicJwk).publicKey.publicKey

    return {
      publicKeyMultibase: multibaseEncode(
        new Uint8Array([0xed, 0x01, ...publicKeyBytes]),
        MultibaseEncoding.BASE58_BTC
      ),
      keyId: key.keyId,
    }
  }

  private handleError(reason: string): DidUpdateResult | DidCreateResult {
    return {
      didDocumentMetadata: {},
      didRegistrationMetadata: {},
      didState: {
        state: 'failed',
        reason,
      },
    }
  }
}
