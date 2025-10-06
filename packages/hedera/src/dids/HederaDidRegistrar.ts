import {
  AgentContext,
  DidCreateResult,
  DidDeactivateOptions,
  DidDeactivateResult,
  DidDocument,
  DidDocumentRole,
  DidDocumentService,
  DidRecord,
  DidRegistrar,
  DidRepository,
  DidUpdateOptions,
  DidUpdateResult,
  JsonTransformer,
} from '@credo-ts/core'
import { HederaDidCreateOptions, HederaLedgerService } from '../ledger'

export class HederaDidRegistrar implements DidRegistrar {
  public readonly supportedMethods = ['hedera']

  async create(agentContext: AgentContext, options: HederaDidCreateOptions): Promise<DidCreateResult> {
    try {
      const didRepository = agentContext.dependencyManager.resolve(DidRepository)
      const ledgerService = agentContext.dependencyManager.resolve(HederaLedgerService)

      const { did, didDocument } = await ledgerService.createDid(agentContext, options)

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

  async update(agentContext: AgentContext, options: DidUpdateOptions): Promise<DidUpdateResult> {
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

      const { didDocument: updatedDidDocument } = await ledgerService.updateDid(agentContext, options)

      didRecord.didDocument = JsonTransformer.fromJSON(updatedDidDocument, DidDocument)
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

  async deactivate(agentContext: AgentContext, options: DidDeactivateOptions): Promise<DidDeactivateResult> {
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
      const { didDocument: deactivatedDidDocument } = await ledgerService.deactivateDid(agentContext, options)

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
}
