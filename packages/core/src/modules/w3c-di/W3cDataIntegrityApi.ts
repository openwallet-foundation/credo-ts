import { AgentContext } from '../../agent'
import { injectable } from '../../plugins'
import { W3cDataIntegrityCryptosuiteRegistry } from './W3cDataIntegrityCryptosuiteRegistry'
import { assertCreated, assertVerified } from './W3cDataIntegrityError'
import type {
  W3cDataIntegrityProofSetSecuredDocument,
  W3cDataIntegritySecuredDocument,
  W3cDataIntegritySingleProofSecuredDocument,
} from './W3cDataIntegrityProof'
import { assertMultiProofDocument, assertSingleProofDocument } from './W3cDataIntegrityProof'
import type {
  W3cDataIntegrityCreateProofOptions,
  W3cDataIntegrityVerifyProofDocumentOptions,
  W3cDataIntegrityVerifyProofOptions,
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

  public async createProof(options: W3cDataIntegrityCreateProofOptions) {
    return await this.dataIntegrityProofService.createProof(this.agentContext, options)
  }

  // ─── Create (Fail-Fast) ───────────────────────────────────────────────────

  public async createProofOrThrow(options: W3cDataIntegrityCreateProofOptions) {
    const result = await this.createProof(options)
    assertCreated(result)
    return result
  }

  // ─── Verify (Explicit Paths) ──────────────────────────────────────────────

  public async verifyProof(
    securedDocument: W3cDataIntegritySingleProofSecuredDocument,
    options?: W3cDataIntegrityVerifyProofOptions
  ) {
    return await this.dataIntegrityProofService.verifyProof(this.agentContext, securedDocument, options)
  }

  public async verifyProofSetAndChain(
    securedDocument: W3cDataIntegrityProofSetSecuredDocument,
    options?: W3cDataIntegrityVerifyProofOptions
  ) {
    return await this.dataIntegrityProofService.verifyProofSetAndChain(this.agentContext, securedDocument, options)
  }

  // ─── Verify (Convenience Dispatcher) ──────────────────────────────────────

  public async verifySecuredDocument(
    securedDocument: W3cDataIntegritySecuredDocument,
    options?: W3cDataIntegrityVerifyProofOptions
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
    securedDocument: W3cDataIntegritySecuredDocument,
    options?: W3cDataIntegrityVerifyProofOptions
  ) {
    const result = await this.verifySecuredDocument(securedDocument, options)
    assertVerified(result)
    return result
  }

  // ─── Verify (Document Parsing + Verification) ─────────────────────────────

  public async verifyProofDocument(options: W3cDataIntegrityVerifyProofDocumentOptions) {
    return await this.dataIntegrityProofService.verifyProofDocument(this.agentContext, options)
  }

  // ─── Metadata ─────────────────────────────────────────────────────────────

  public getSupportedCryptosuites() {
    return this.dataIntegrityCryptosuiteRegistry.supportedCryptosuites
  }
}
