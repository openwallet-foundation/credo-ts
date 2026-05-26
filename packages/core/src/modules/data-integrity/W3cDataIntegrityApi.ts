import { AgentContext } from '../../agent'
import { injectable } from '../../plugins'
import { W3cDataIntegrityCryptosuiteRegistry } from './W3cDataIntegrityCryptosuiteRegistry'
import { assertCreated, assertVerified } from './DataIntegrityError'
import type {
  DataIntegrityProofSetSecuredDocument,
  DataIntegritySecuredDocument,
  DataIntegritySingleProofSecuredDocument,
} from './DataIntegrityProof'
import { assertMultiProofDocument, assertSingleProofDocument } from './DataIntegrityProof'
import type {
  DataIntegrityCreateProofOptions,
  DataIntegrityVerifyProofDocumentOptions,
  DataIntegrityVerifyProofOptions,
} from './W3cDataIntegrityProofService'
import { W3cDataIntegrityProofService } from './W3cDataIntegrityProofService'

@injectable()
export class W3cDataIntegrityApi {
  private agentContext: AgentContext
  private dataIntegrityProofService: W3cDataIntegrityProofService
  private dataIntegrityCryptosuiteRegistry: W3cDataIntegrityCryptosuiteRegistry

  public constructor(
    agentContext: AgentContext,
    dataIntegrityProofService: W3cDataIntegrityProofService,
    dataIntegrityCryptosuiteRegistry: W3cDataIntegrityCryptosuiteRegistry
  ) {
    this.agentContext = agentContext
    this.dataIntegrityProofService = dataIntegrityProofService
    this.dataIntegrityCryptosuiteRegistry = dataIntegrityCryptosuiteRegistry
  }

  // ─── Create (Result-Based) ────────────────────────────────────────────────

  public async createProof(options: DataIntegrityCreateProofOptions) {
    return await this.dataIntegrityProofService.createProof(this.agentContext, options)
  }

  // ─── Create (Fail-Fast) ───────────────────────────────────────────────────

  public async createProofOrThrow(options: DataIntegrityCreateProofOptions) {
    const result = await this.createProof(options)
    assertCreated(result)
    return result
  }

  // ─── Verify (Explicit Paths) ──────────────────────────────────────────────

  public async verifyProof(
    securedDocument: DataIntegritySingleProofSecuredDocument,
    options?: DataIntegrityVerifyProofOptions
  ) {
    return await this.dataIntegrityProofService.verifyProof(this.agentContext, securedDocument, options)
  }

  public async verifyProofSetAndChain(
    securedDocument: DataIntegrityProofSetSecuredDocument,
    options?: DataIntegrityVerifyProofOptions
  ) {
    return await this.dataIntegrityProofService.verifyProofSetAndChain(this.agentContext, securedDocument, options)
  }

  // ─── Verify (Convenience Dispatcher) ──────────────────────────────────────

  public async verifySecuredDocument(
    securedDocument: DataIntegritySecuredDocument,
    options?: DataIntegrityVerifyProofOptions
  ) {
    if (Array.isArray(securedDocument.proof)) {
      assertMultiProofDocument(securedDocument)
      return await this.verifyProofSetAndChain(securedDocument, options)
    }

    assertSingleProofDocument(securedDocument)
    return await this.verifyProof(securedDocument, options)
  }

  // ─── Verify (Fail-Fast) ───────────────────────────────────────────────────

  public async verifySecuredDocumentOrThrow(
    securedDocument: DataIntegritySecuredDocument,
    options?: DataIntegrityVerifyProofOptions
  ) {
    const result = await this.verifySecuredDocument(securedDocument, options)
    assertVerified(result)
    return result
  }

  // ─── Verify (Document Parsing + Verification) ─────────────────────────────

  public async verifyProofDocument(options: DataIntegrityVerifyProofDocumentOptions) {
    return await this.dataIntegrityProofService.verifyProofDocument(this.agentContext, options)
  }

  // ─── Metadata ─────────────────────────────────────────────────────────────

  public getSupportedCryptosuites() {
    return this.dataIntegrityCryptosuiteRegistry.supportedCryptosuites
  }
}
