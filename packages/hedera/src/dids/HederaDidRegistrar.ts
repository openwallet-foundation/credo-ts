import {
  AgentContext,
  DidCreateResult,
  DidDeactivateResult,
  DidDocument,
  DidDocumentKey,
  DidDocumentRole,
  DidDocumentService,
  DidRecord,
  DidRegistrar,
  DidRepository,
  DidUpdateResult,
  JsonTransformer,
} from '@credo-ts/core'
import {
  HederaDidCreateOptions,
  HederaDidDeactivateOptions,
  HederaDidUpdateOptions,
  HederaLedgerService,
} from '../ledger/HederaLedgerService'

export class HederaDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['hedera']

  async create(agentContext: AgentContext, options: HederaDidCreateOptions): Promise<DidCreateResult> {
    try {
      const didRepository = agentContext.dependencyManager.resolve(DidRepository)
      const ledgerService = agentContext.dependencyManager.resolve(HederaLedgerService)

      const { did, didDocument, rootKey } = await ledgerService.createDid(agentContext, options)

      const credoDidDocument = new DidDocument({
        ...didDocument,
        service: didDocument.service?.map((s) => new DidDocumentService(s)),
      })

      await didRepository.save(
        agentContext,
        new DidRecord({
          did,
          role: DidDocumentRole.Created,
          didDocument: credoDidDocument,
          keys: [rootKey],
        })
      )

      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'finished',
          did,
          didDocument: credoDidDocument,
        },
      }
    } catch (error) {
      agentContext.config.logger.debug('Error creating DID', {
        error,
      })
      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: `Unable to register Did: ${error.message}`,
        },
      }
    }
  }

  async update(agentContext: AgentContext, options: HederaDidUpdateOptions): Promise<DidUpdateResult> {
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)
    const ledgerService = agentContext.dependencyManager.resolve(HederaLedgerService)

    try {
      const { did } = options
      const { didDocument, didDocumentMetadata } = await ledgerService.resolveDid(agentContext, did)
      const didRecord = await didRepository.findCreatedDid(agentContext, did)
      if (!didDocument || didDocumentMetadata.deactivated || !didRecord) {
        return {
          didDocumentMetadata: {},
          didRegistrationMetadata: {},
          didState: {
            state: 'failed',
            reason: 'Did not found',
          },
        }
      }

      const keys = this.concatKeys(didRecord.keys, options.secret?.keys)
      const { didDocument: updatedDidDocument } = await ledgerService.updateDid(agentContext, {
        ...options,
        secret: { keys },
      })

      didRecord.didDocument = JsonTransformer.fromJSON(updatedDidDocument, DidDocument)
      didRecord.keys = keys
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
      agentContext.config.logger.error('Error updating DID', error)
      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: `Unable update DID: ${error.message}`,
        },
      }
    }
  }

  async deactivate(
    agentContext: AgentContext,
    options: Omit<HederaDidDeactivateOptions, 'secret'>
  ): Promise<DidDeactivateResult> {
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)
    const ledgerService = agentContext.dependencyManager.resolve(HederaLedgerService)

    const did = options.did

    try {
      const { didDocument, didDocumentMetadata } = await ledgerService.resolveDid(agentContext, did)

      const didRecord = await didRepository.findCreatedDid(agentContext, did)

      if (!didDocument || didDocumentMetadata.deactivated || !didRecord) {
        return {
          didDocumentMetadata,
          didRegistrationMetadata: {},
          didState: {
            state: 'failed',
            reason: 'Did not found',
          },
        }
      }
      const { didDocument: deactivatedDidDocument } = await ledgerService.deactivateDid(agentContext, {
        ...options,
        secret: { keys: didRecord.keys },
      })

      didRecord.didDocument = JsonTransformer.fromJSON(deactivatedDidDocument, DidDocument)
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
      agentContext.config.logger.error('Error deactivating DID', error)
      return {
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: `Unable deactivating DID: ${error.message}`,
        },
      }
    }
  }

  private concatKeys(keys1: DidDocumentKey[] = [], keys2: DidDocumentKey[] = []): DidDocumentKey[] {
    return [
      ...keys1,
      ...keys2.filter((k2) => !keys1.some((k1) => k1.didDocumentRelativeKeyId === k2.didDocumentRelativeKeyId)),
    ]
  }
}
