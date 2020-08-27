declare module 'indy-sdk' {
  const indy: Indy;
  export default indy;

  // NOTE: This interface is exactly the same as the Indy interface below in this file
  // Due to how typing works we can't use that one over here. They should be manually kept in sync (via copy paste!)
  export interface Indy {
    createWallet(config: WalletConfig, credentials: WalletCredentials): Promise<void>;
    openWallet(config: WalletConfig, credentials: OpenWalletCredentials): Promise<WalletHandle>;
    closeWallet(wh: WalletHandle): Promise<void>;
    deleteWallet(config: WalletConfig, credentials: WalletCredentials): Promise<void>;
    createAndStoreMyDid(wh: WalletHandle, did: DidConfig): Promise<[Did, Verkey]>;
    keyForLocalDid(wh: WalletHandle, did: Did): Promise<Verkey>;
    cryptoAnonCrypt(recipientVk: Verkey, messageRaw: Buffer): Promise<Buffer>;
    cryptoSign(wh: WalletHandle, signerVk: Verkey, messageRaw: Buffer): Promise<Buffer>;
    cryptoVerify(signerVk: Verkey, messageRaw: Buffer, signatureRaw: Buffer): Promise<boolean>;
    createKey(wh: WalletHandle, key: KeyConfig): Promise<Verkey>;
    packMessage(wh: WalletHandle, message: Buffer, receiverKeys: Verkey[], senderVk: Verkey | null): Promise<Buffer>;
    unpackMessage(wh: WalletHandle, jwe: Buffer): Promise<Buffer>;
    addWalletRecord(
      wh: WalletHandle,
      type: string,
      id: string,
      value: string,
      tags: Record<string, string>
    ): Promise<void>;
    updateWalletRecordValue(wh: WalletHandle, type: string, id: string, value: string): Promise<void>;
    updateWalletRecordTags(wh: WalletHandle, type: string, id: string, tags: Record<string, string>): Promise<void>;
    addWalletRecordTags(wh: WalletHandle, type: string, id: string, tags: Record<string, string>): Promise<void>;
    deleteWalletRecord(wh: WalletHandle, type: string, id: string): Promise<void>;
    getWalletRecord(wh: WalletHandle, type: string, id: string, options: WalletRecordOptions): Promise<WalletRecord>;
    openWalletSearch(
      wh: WalletHandle,
      type: string,
      query: WalletQuery,
      options: WalletSearchOptions
    ): Promise<SearchHandle>;
    fetchWalletSearchNextRecords(
      wh: WalletHandle,
      searchHandle: SearchHandle,
      count: number
    ): Promise<WalletRecordSearch>;
    closeWalletSearch(sh: SearchHandle): Promise<void>;
    createPoolLedgerConfig(configName: string, config?: PoolConfig): Promise<void>;
    openPoolLedger(configName: string, config?: RuntimePoolConfig): Promise<PoolHandle>;
    setProtocolVersion(version: number): Promise<void>;
    buildGetNymRequest(submitterDid: Did | null, targetDid: Did): Promise<LedgerRequest>;
    parseGetNymResponse(response: LedgerResponse): Promise<GetNymResponse>;
    buildSchemaRequest(submitterDid: Did, schema: Schema): Promise<LedgerRequest>;
    buildGetSchemaRequest(submitterDid: Did | null, schemaId: SchemaId): Promise<LedgerRequest>;
    parseGetSchemaResponse(response: LedgerResponse): Promise<[SchemaId, Schema]>;
    buildCredDefRequest(submitterDid: Did, credDef: CredDef): Promise<LedgerRequest>;
    buildGetCredDefRequest(submitterDid: Did | null, credDefId: CredDefId): Promise<LedgerRequest>;
    parseGetCredDefResponse(response: LedgerResponse): Promise<[CredDefId, CredDef]>;
    signRequest(wh: WalletHandle, submitterDid: Did, request: LedgerRequest): Promise<SignedLedgerRequest>;
    submitRequest(poolHandle: PoolHandle, request: LedgerRequest): Promise<LedgerResponse>;
    issuerCreateSchema(myDid: Did, name: string, version: string, attributes: string[]): Promise<[SchemaId, Schema]>;
    issuerCreateAndStoreCredentialDef(
      wh: WalletHandle,
      myDid: Did,
      schema: Schema,
      tag: string,
      signatureType: string,
      config?: CredDefConfig
    ): Promise<[CredDefId, CredDef]>;
    buildGetTxnAuthorAgreementRequest(submitterDid: Did | null): Promise<LedgerRequest>;
    buildGetAcceptanceMechanismsRequest(submitterDid: Did | null): Promise<LedgerRequest>;
    appendTxnAuthorAgreementAcceptanceToRequest(
      request: LedgerRequest,
      text: string,
      version: string,
      digest: string,
      accMechType: string,
      timeOfAcceptance: number
    ): Promise<LedgerRequest>;
    abbreviateVerkey(did: Did, fullVerkey: Verkey): Promise<Verkey>;
  }
}

// -------------------------------------------------------------------------------- //
// -------------------------------------------------------------------------------- //
// -------------------------------------------------------------------------------- //

interface Indy {
  createWallet(config: WalletConfig, credentials: WalletCredentials): Promise<void>;
  openWallet(config: WalletConfig, credentials: OpenWalletCredentials): Promise<WalletHandle>;
  closeWallet(wh: WalletHandle): Promise<void>;
  deleteWallet(config: WalletConfig, credentials: WalletCredentials): Promise<void>;
  createAndStoreMyDid(wh: WalletHandle, did: DidConfig): Promise<[Did, Verkey]>;
  keyForLocalDid(wh: WalletHandle, did: Did): Promise<Verkey>;
  cryptoAnonCrypt(recipientVk: Verkey, messageRaw: Buffer): Promise<Buffer>;
  cryptoSign(wh: WalletHandle, signerVk: Verkey, messageRaw: Buffer): Promise<Buffer>;
  cryptoVerify(signerVk: Verkey, messageRaw: Buffer, signatureRaw: Buffer): Promise<boolean>;
  createKey(wh: WalletHandle, key: KeyConfig): Promise<Verkey>;
  packMessage(wh: WalletHandle, message: Buffer, receiverKeys: Verkey[], senderVk: Verkey | null): Promise<Buffer>;
  unpackMessage(wh: WalletHandle, jwe: Buffer): Promise<Buffer>;
  addWalletRecord(
    wh: WalletHandle,
    type: string,
    id: string,
    value: string,
    tags: Record<string, string>
  ): Promise<void>;
  updateWalletRecordValue(wh: WalletHandle, type: string, id: string, value: string): Promise<void>;
  updateWalletRecordTags(wh: WalletHandle, type: string, id: string, tags: Record<string, string>): Promise<void>;
  addWalletRecordTags(wh: WalletHandle, type: string, id: string, tags: Record<string, string>): Promise<void>;
  deleteWalletRecord(wh: WalletHandle, type: string, id: string): Promise<void>;
  getWalletRecord(wh: WalletHandle, type: string, id: string, options: WalletRecordOptions): Promise<WalletRecord>;
  openWalletSearch(
    wh: WalletHandle,
    type: string,
    query: WalletQuery,
    options: WalletSearchOptions
  ): Promise<SearchHandle>;
  fetchWalletSearchNextRecords(
    wh: WalletHandle,
    searchHandle: SearchHandle,
    count: number
  ): Promise<WalletRecordSearch>;
  closeWalletSearch(sh: SearchHandle): Promise<void>;
  createPoolLedgerConfig(configName: string, config?: PoolConfig): Promise<void>;
  openPoolLedger(configName: string, config?: RuntimePoolConfig): Promise<PoolHandle>;
  setProtocolVersion(version: number): Promise<void>;
  buildGetNymRequest(submitterDid: Did | null, targetDid: Did): Promise<LedgerRequest>;
  parseGetNymResponse(response: LedgerResponse): Promise<GetNymResponse>;
  buildSchemaRequest(submitterDid: Did, schema: Schema): Promise<LedgerRequest>;
  buildGetSchemaRequest(submitterDid: Did | null, schemaId: SchemaId): Promise<LedgerRequest>;
  parseGetSchemaResponse(response: LedgerResponse): Promise<[SchemaId, Schema]>;
  buildCredDefRequest(submitterDid: Did, credDef: CredDef): Promise<LedgerRequest>;
  buildGetCredDefRequest(submitterDid: Did | null, credDefId: CredDefId): Promise<LedgerRequest>;
  parseGetCredDefResponse(response: LedgerResponse): Promise<[CredDefId, CredDef]>;
  signRequest(wh: WalletHandle, submitterDid: Did, request: LedgerRequest): Promise<SignedLedgerRequest>;
  submitRequest(poolHandle: PoolHandle, request: LedgerRequest): Promise<LedgerResponse>;
  issuerCreateSchema(myDid: Did, name: string, version: string, attributes: string[]): Promise<[SchemaId, Schema]>;
  issuerCreateAndStoreCredentialDef(
    wh: WalletHandle,
    myDid: Did,
    schema: Schema,
    tag: string,
    signatureType: string,
    config?: CredDefConfig
  ): Promise<[CredDefId, CredDef]>;
  buildGetTxnAuthorAgreementRequest(submitterDid: Did | null): Promise<LedgerRequest>;
  buildGetAcceptanceMechanismsRequest(submitterDid: Did | null): Promise<LedgerRequest>;
  appendTxnAuthorAgreementAcceptanceToRequest(
    request: LedgerRequest,
    text: string,
    version: string,
    digest: string,
    accMechType: string,
    timeOfAcceptance: number
  ): Promise<LedgerRequest>;
  abbreviateVerkey(did: Did, fullVerkey: Verkey): Promise<Verkey>;
}

type WalletHandle = number;
type SearchHandle = number;
type PoolHandle = number;
type Did = string;
type Verkey = string;
type ByteArray = number[];
type SchemaId = string;
type CredDefId = string;
type KeyDerivationMethod = 'ARGON2I_MOD' | 'ARGON2I_INT' | 'RAW';

// TODO: Maybe we can make this a bit more specific?
type WalletQuery = Record<string, unknown>;

interface WalletRecordOptions {
  retrieveType?: boolean;
  retrieveValue?: boolean;
  retrieveTags?: boolean;
}

interface WalletSearchOptions extends WalletRecordOptions {
  retrieveRecords?: boolean;
  retrieveTotalCount?: boolean;
}

interface WalletConfig {
  id: string;
  storage_type?: string;
  storage_config?: WalletStorageConfig;
}

interface WalletStorageConfig {
  [key: string]: unknown;
  path?: string;
}

interface WalletCredentials {
  key: string;
  storage_credentials?: {
    [key: string]: unknown;
  };
  key_derivation_method?: KeyDerivationMethod;
}

interface OpenWalletCredentials extends WalletCredentials {
  rekey_derivation_method?: KeyDerivationMethod;
}

interface DidConfig {
  did?: string;
  seed?: string;
  crypto_type?: 'ed25519';
  cid?: boolean;
  method_name?: string;
}

interface LedgerRequest {
  reqId: number;
  identifier: string;
  operation: Record<string, unknown>;
  protocolVersion: number;
}

interface SignedLedgerRequest extends LedgerRequest {
  signature: string;
}

interface LedgerResponse {
  op: string;
  result: {
    data: unknown;
  };
}

interface Schema {
  id: SchemaId;
  attrNames: string[];
  name: string;
  version: string;
  ver: string;
}

interface CredDef {
  id: string;
  schemaId: string;
  type: string;
  tag: string;
  value: {
    primary: Record<string, unknown>;
    revocation: unknown;
  };
  ver: string;
}

interface CredDefConfig {
  support_revocation?: boolean;
}

interface KeyConfig {
  seed?: string;
}

interface PoolConfig {
  genesis_txn: string;
}

interface RuntimePoolConfig {
  timeout?: number;
  extended_timeout?: number;
  preordered_nodes?: string[];
  number_read_nodes?: number;
}

interface WalletRecord {
  id: string;
  type?: string;
  value?: string;
  tags?: {
    [key: string]: string | undefined;
  };
}

interface WalletRecordSearch {
  totalCount: string | null;
  records: WalletRecord[];
}

interface GetNymResponse {
  did: Did;
  verkey: Verkey;
  role: NymRole;
}

declare enum NymRole {
  TRUSTEE = 0,
  STEWARD = 2,
  TRUST_ANCHOR = 101,
  ENDORSER = 101,
  NETWORK_MONITOR = 201,
}
