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
} from '@credo-ts/core'

import { CredoError, DidDocument, DidDocumentRole, DidRecord, DidRepository, parseDid } from '@credo-ts/core'
import {
  type CreateDIDOptions,
  createDID,
  type DeactivateDIDOptions,
  deactivateDID,
  type UpdateDIDOptions,
  type UpdateDIDResult,
  updateDID,
  type WitnessProofFileEntry,
} from 'didwebvh-ts'

import { WebVhDidCrypto } from './WebVhDidCrypto'
import {
  failedWebVhRegistration,
  getWebVhDidLog,
  getWebVhDidRecord,
  persistWebVhDocumentWrite,
  prepareWebVhDocumentWrite,
  resolveWebVhControllerState,
  selectWebVhControllerSigner,
  validateWebVhControllerKeys,
  validateWebVhDocumentKeys,
} from './webVhDidController'
import { WebVhDidRecordMetadataKeys, type WebVhUpdateKeyKmsKeyIds } from './webVhDidRecordMetadataTypes'

export interface WebVhDidCreateOptions extends DidCreateOptions {
  method: 'webvh'
  didDocument: DidDocument
  options: Omit<CreateDIDOptions, 'didDocument' | 'signer' | 'verifier' | 'address'> & {
    address: string
    keys: DidDocumentKey[]
    updateKeyKmsKeyIds: WebVhUpdateKeyKmsKeyIds
  }
}

export interface WebVhDidUpdateOptions extends DidUpdateOptions {
  didDocument: DidDocument
  options?: Omit<UpdateDIDOptions, 'didDocument' | 'signer' | 'verifier' | 'fetch' | 'log'> & {
    keys?: DidDocumentKey[]
    updateKeyKmsKeyIds?: WebVhUpdateKeyKmsKeyIds
  }
}

export interface WebVhDidDeactivateOptions extends DidDeactivateOptions {
  options?: Pick<DeactivateDIDOptions, 'updateKeys' | 'witnessProofs'>
}

export class WebVhDidRegistrar implements DidRegistrar {
  public readonly supportedMethods: string[] = ['webvh']

  /**
   * Creates and stores a complete caller-authored document using existing KMS keys; publication is caller-managed.
   *
   * @param agentContext Agent context providing storage and KMS.
   * @param options Complete document, upstream create options, and KMS mappings.
   * @returns Finished registration with upstream metadata, or a failed registration with its reason.
   */
  public async create(agentContext: AgentContext, options: WebVhDidCreateOptions): Promise<DidCreateResult> {
    try {
      this.assertCompleteDocument(options.didDocument)
      const { keys, updateKeyKmsKeyIds, ...upstreamOptions } = options.options
      const { address, paths, updateKeys } = upstreamOptions
      if (!Array.isArray(keys) || !updateKeyKmsKeyIds || !Array.isArray(updateKeys)) {
        throw new CredoError('Create options require keys, updateKeyKmsKeyIds, and updateKeys')
      }
      const domain = [address, ...(paths ?? [])].join(':')
      const repository = agentContext.dependencyManager.resolve(DidRepository)
      const existing = await repository.findSingleByQuery(agentContext, {
        role: DidDocumentRole.Created,
        domain,
        method: 'webvh',
      })
      if (existing) throw new CredoError(`A record with domain "${address}" already exists.`)

      await validateWebVhDocumentKeys(agentContext, options.didDocument, keys)
      await validateWebVhControllerKeys(agentContext, updateKeyKmsKeyIds)
      const signer = await selectWebVhControllerSigner(agentContext, updateKeys, updateKeyKmsKeyIds)
      const result = await createDID({
        ...upstreamOptions,
        didDocument: { ...options.didDocument.toJSON(), id: options.didDocument.id },
        signer,
        verifier: new WebVhDidCrypto(agentContext),
      })
      const didDocument = DidDocument.fromJSON(result.doc)
      await validateWebVhDocumentKeys(agentContext, didDocument, keys)
      const returnedDomain = this.domainTag(result.did)
      if (
        returnedDomain !== domain &&
        (await repository.findSingleByQuery(agentContext, {
          role: DidDocumentRole.Created,
          domain: returnedDomain,
          method: 'webvh',
        }))
      ) {
        throw new CredoError(`A record with domain "${returnedDomain}" already exists.`)
      }
      const record = new DidRecord({
        did: result.did,
        didDocument,
        role: DidDocumentRole.Created,
        keys,
        tags: { domain: returnedDomain },
      })
      this.persistResult(record, result, updateKeyKmsKeyIds)
      await repository.save(agentContext, record)
      return this.finished(result, didDocument)
    } catch (error) {
      return this.failed(agentContext, 'create', error)
    }
  }

  /**
   * Replaces the complete document using authenticated controller keys, retaining matching document-key mappings when omitted.
   *
   * @param agentContext Agent context providing storage, KMS, and configured fetch.
   * @param options Controlled DID, replacement document, and optional upstream options and KMS mappings.
   * @returns Finished registration with upstream metadata, or a failed registration with its reason.
   */
  public async update(agentContext: AgentContext, options: WebVhDidUpdateOptions): Promise<DidUpdateResult> {
    try {
      this.assertCompleteDocument(options.didDocument)
      if (options.didDocumentOperation && options.didDocumentOperation !== 'setDidDocument') {
        throw new CredoError('notSupported: WebVH update requires setDidDocument with a complete DID document')
      }
      const prepared = await prepareWebVhDocumentWrite(
        agentContext,
        options.did,
        options.didDocument,
        options.options ?? {}
      )
      const result = await updateDID(prepared.writerOptions)
      const didDocument = await persistWebVhDocumentWrite(agentContext, prepared, result)
      return this.finished(result, didDocument)
    } catch (error) {
      return this.failed(agentContext, 'update', error)
    }
  }

  /**
   * Stores a signed deactivation entry; active pre-rotation must first be cleared by a separate update.
   *
   * @param agentContext Agent context providing storage, KMS, and configured fetch.
   * @param options Controlled DID and optional update keys and witness proofs.
   * @returns Finished deactivation with upstream metadata, or a failed registration with its reason.
   */
  public async deactivate(
    agentContext: AgentContext,
    options: WebVhDidDeactivateOptions
  ): Promise<DidDeactivateResult> {
    try {
      const record = await getWebVhDidRecord(agentContext, options.did)
      const state = await resolveWebVhControllerState(agentContext, record, options.options?.witnessProofs)
      const updateKeys = state.didDocumentMetadata.updateKeys
      if (!Array.isArray(updateKeys) || !updateKeys.every((key): key is string => typeof key === 'string')) {
        throw new CredoError(`unknownError: controlled DID '${options.did}' has no authenticated update keys`)
      }
      const controllerKeys =
        record.metadata.get<WebVhUpdateKeyKmsKeyIds>(WebVhDidRecordMetadataKeys.UpdateKeyKmsKeyIds) ?? {}
      const signer = await selectWebVhControllerSigner(agentContext, updateKeys, controllerKeys)
      const result = await deactivateDID({
        log: getWebVhDidLog(record),
        updateKeys: options.options?.updateKeys,
        witnessProofs:
          options.options?.witnessProofs ??
          record.metadata.get<WitnessProofFileEntry[]>(WebVhDidRecordMetadataKeys.WitnessProofs) ??
          undefined,
        signer,
        verifier: new WebVhDidCrypto(agentContext),
        fetch: agentContext.config.fetch.bind(agentContext.config),
      })
      const didDocument = DidDocument.fromJSON(result.doc)
      this.persistResult(record, result, controllerKeys)
      if (options.options?.witnessProofs)
        record.metadata.set(WebVhDidRecordMetadataKeys.WitnessProofs, options.options.witnessProofs)
      await agentContext.dependencyManager.resolve(DidRepository).update(agentContext, record)
      return this.finished(result, didDocument)
    } catch (error) {
      return this.failed(agentContext, 'deactivate', error)
    }
  }

  private assertCompleteDocument(document: DidDocument) {
    if (!(document instanceof DidDocument) || !document.id) {
      throw new CredoError('notSupported: WebVH requires a complete DidDocument with an id')
    }
  }

  private domainTag(did: string) {
    // Preserve the legacy domain[:path] tag using the location upstream actually returned.
    return parseDid(did).id.split(':').slice(1).map(decodeURIComponent).join(':')
  }

  private persistResult(record: DidRecord, result: UpdateDIDResult, controllerKeys: WebVhUpdateKeyKmsKeyIds) {
    record.did = result.did
    record.didDocument = DidDocument.fromJSON(result.doc)
    record.metadata.set(WebVhDidRecordMetadataKeys.DidLog, result.log)
    record.metadata.set(WebVhDidRecordMetadataKeys.ControllerMetadata, result.meta)
    record.metadata.set(WebVhDidRecordMetadataKeys.UpdateKeyKmsKeyIds, controllerKeys)
  }

  private finished(result: UpdateDIDResult, didDocument: DidDocument): DidCreateResult {
    return {
      didDocumentMetadata: result.meta,
      didRegistrationMetadata: {},
      didState: { state: 'finished', did: result.did, didDocument },
    }
  }

  private failed(agentContext: AgentContext, operation: string, error: unknown): DidCreateResult {
    return failedWebVhRegistration(agentContext, operation, error)
  }
}
