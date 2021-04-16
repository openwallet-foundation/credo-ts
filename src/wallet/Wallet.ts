import type {
  DidConfig,
  Did,
  Verkey,
  Schema,
  CredDefConfig,
  CredDefId,
  CredDef,
  CredOffer,
  CredReq,
  CredReqMetadata,
  CredValues,
  Cred,
  CredRevocId,
  RevocRegDelta,
  IndyProofRequest,
  IndyRequestedCredentials,
  Schemas,
  CredentialDefs,
  RevStates,
  IndyProof,
  CredentialId,
  IndyCredentialInfo,
  WalletRecordOptions,
  WalletRecord,
  WalletQuery,
  WalletSearchOptions,
  LedgerRequest,
  IndyCredential,
  RevRegsDefs,
} from 'indy-sdk'
import { UnpackedMessageContext } from '../types'

export interface Wallet {
  publicDid: DidInfo | undefined

  init(): Promise<void>
  close(): Promise<void>
  delete(): Promise<void>
  initPublicDid(didConfig: DidConfig): Promise<void>
  createDid(didConfig?: DidConfig): Promise<[Did, Verkey]>
  createCredentialDefinition(
    issuerDid: Did,
    schema: Schema,
    tag: string,
    signatureType: string,
    config?: CredDefConfig
  ): Promise<[CredDefId, CredDef]>
  createCredentialOffer(credDefId: CredDefId): Promise<CredOffer>
  createCredentialRequest(proverDid: Did, offer: CredOffer, credDef: CredDef): Promise<[CredReq, CredReqMetadata]>
  createCredential(
    credOffer: CredOffer,
    credReq: CredReq,
    credValues: CredValues
  ): Promise<[Cred, CredRevocId, RevocRegDelta]>
  createProof(
    proofRequest: IndyProofRequest,
    requestedCredentials: IndyRequestedCredentials,
    schemas: Schemas,
    credentialDefs: CredentialDefs,
    revStates: RevStates
  ): Promise<IndyProof>
  getCredentialsForProofRequest(proofRequest: IndyProofRequest, attributeReferent: string): Promise<IndyCredential[]>
  // TODO Method `verifyProof` does not have a dependency on `wallet`, we could eventually move it outside to another class.
  verifyProof(
    proofRequest: IndyProofRequest,
    proof: IndyProof,
    schemas: Schemas,
    credentialDefs: CredentialDefs,
    revRegsDefs: RevRegsDefs,
    revRegs: RevStates
  ): Promise<boolean>
  storeCredential(
    credentialId: CredentialId,
    credReqMetadata: CredReqMetadata,
    cred: Cred,
    credDef: CredDef
  ): Promise<string>
  getCredential(credentialId: CredentialId): Promise<IndyCredentialInfo>
  pack(payload: Record<string, unknown>, recipientKeys: Verkey[], senderVk: Verkey | null): Promise<JsonWebKey>
  unpack(messagePackage: JsonWebKey): Promise<UnpackedMessageContext>
  sign(data: Buffer, verkey: Verkey): Promise<Buffer>
  verify(signerVerkey: Verkey, data: Buffer, signature: Buffer): Promise<boolean>
  addWalletRecord(type: string, id: string, value: string, tags: Record<string, string | undefined>): Promise<void>
  updateWalletRecordValue(type: string, id: string, value: string): Promise<void>
  updateWalletRecordTags(type: string, id: string, tags: Record<string, string | undefined>): Promise<void>
  deleteWalletRecord(type: string, id: string): Promise<void>
  getWalletRecord(type: string, id: string, options: WalletRecordOptions): Promise<WalletRecord>
  search(type: string, query: WalletQuery, options: WalletSearchOptions): Promise<AsyncIterable<WalletRecord>>
  signRequest(myDid: Did, request: LedgerRequest): Promise<LedgerRequest>
  generateNonce(): Promise<string>
}

export interface DidInfo {
  did: Did
  verkey: Verkey
}
