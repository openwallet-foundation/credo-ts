interface Indy {
  createWallet(config: {}, credentials: {}): Promise<void>;
  openWallet(config: {}, credentials: {}): Promise<WalletHandle>;
  closeWallet(wh: WalletHandle): Promise<void>;
  deleteWallet(config: {}, credentials: {}): Promise<void>;
  createAndStoreMyDid(wh: WalletHandle, credentials: {}): Promise<[Did, Verkey]>;
  keyForLocalDid(wh: WalletHandle, did: Did): Promise<Verkey>;
  cryptoAnonCrypt(recipientVk: Verkey, messageRaw: Buffer): Promise<Buffer>;
  cryptoSign(wh: WalletHandle, signerVk: Verkey, messageRaw: Buffer): Promise<Buffer>;
  cryptoVerify(signerVk: Verkey, messageRaw: Buffer, signatureRaw: Buffer): Promise<boolean>;
  createKey(wh: WalletHandle, key: KeyConfig): Promise<Verkey>;
  packMessage(wh: WalletHandle, message: Buffer, receiverKeys: Verkey[], senderVk: Verkey | null): Promise<Buffer>;
  unpackMessage(wh: WalletHandle, jwe: Buffer): Promise<Buffer>;
  addWalletRecord(wh: WalletHandle, type: string, id: string, value: string, tags: {}): Promise<void>;
  updateWalletRecordValue(wh: WalletHandle, type: string, id: string, value: string): Promise<void>;
  updateWalletRecordTags(wh: WalletHandle, type: string, id: string, tags: {}): Promise<void>;
  addWalletRecordTags(wh: WalletHandle, type: string, id: string, tags: {}): Promise<void>;
  deleteWalletRecord(wh: WalletHandle, type: string, id: string): Promise<void>;
  getWalletRecord(wh: WalletHandle, type: string, id: string, options: {}): Promise<WalletRecord>;
  openWalletSearch(wh: WalletHandle, type: string, query: {}, options: {}): Promise<SearchHandle>;
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
  parseGetNymResponse(response: LedgerResponse): Promise<{}>;
  buildSchemaRequest(myDid: Did, schema: Schema): Promise<LedgerRequest>;
  buildGetSchemaRequest(myDid: Did, schemaId: SchemaId): Promise<LedgerRequest>;
  parseGetSchemaResponse(response: LedgerResponse): Promise<[SchemaId, Schema]>;
  buildCredDefRequest(submitterDid: Did, credDef: CredDef): Promise<LedgerRequest>;
  buildGetCredDefRequest(submitterDid: Did, credDefId: CredDefId): Promise<LedgerRequest>;
  parseGetCredDefResponse(response: LedgerResponse): Promise<[CredDefId, CredDef]>;
  signRequest(wh: WalletHandle, myDid: Did, request: LedgerRequest): Promise<SignedLedgerRequest>;
  submitRequest(poolHandle: PoolHandle, request: LedgerRequest): Promise<LedgerResponse>;
  issuerCreateSchema(myDid: Did, name: string, version: string, attributes: string[]): Promise<[SchemaId, Schema]>;
  issuerCreateAndStoreCredentialDef(
    wh: WalletHandle,
    myDid: Did,
    schema: Schema,
    tag: string,
    signatureType: string,
    config: {}
  ): Promise<[CredDefId, CredDef]>;
}

declare module 'indy-sdk' {
  function createWallet(config: {}, credentials: {}): Promise<void>;
  function openWallet(config: {}, credentials: {}): Promise<WalletHandle>;
  function closeWallet(wh: WalletHandle): Promise<void>;
  function deleteWallet(config: {}, credentials: {}): Promise<void>;
  function createAndStoreMyDid(wh: WalletHandle, credentials: {}): Promise<[Did, Verkey]>;
  function keyForLocalDid(wh: WalletHandle, did: Did): Promise<Verkey>;
  function cryptoAnonCrypt(recipientVk: Verkey, messageRaw: Buffer): Promise<Buffer>;
  function cryptoSign(wh: WalletHandle, signerVk: Verkey, messageRaw: Buffer): Promise<Buffer>;
  function cryptoVerify(signerVk: Verkey, messageRaw: Buffer, signatureRaw: Buffer): Promise<boolean>;
  function createKey(wh: WalletHandle, key: KeyConfig): Promise<Verkey>;
  function packMessage(
    wh: WalletHandle,
    message: Buffer,
    receiverKeys: Verkey[],
    senderVk: Verkey | null
  ): Promise<Buffer>;
  function unpackMessage(wh: WalletHandle, jwe: Buffer): Promise<Buffer>;
  function addWalletRecord(wh: WalletHandle, type: string, id: string, value: string, tags: {}): Promise<void>;
  function updateWalletRecordValue(wh: WalletHandle, type: string, id: string, value: string): Promise<void>;
  function updateWalletRecordTags(wh: WalletHandle, type: string, id: string, tags: {}): Promise<void>;
  function addWalletRecordTags(wh: WalletHandle, type: string, id: string, tags: {}): Promise<void>;
  function deleteWalletRecord(wh: WalletHandle, type: string, id: string): Promise<void>;
  function getWalletRecord(wh: WalletHandle, type: string, id: string, options: {}): Promise<WalletRecord>;
  function openWalletSearch(wh: WalletHandle, type: string, query: {}, options: {}): Promise<SearchHandle>;
  function fetchWalletSearchNextRecords(
    wh: WalletHandle,
    searchHandle: SearchHandle,
    count: number
  ): Promise<WalletRecordSearch>;
  function closeWalletSearch(sh: SearchHandle): Promise<void>;
  function createPoolLedgerConfig(configName: string, config?: PoolConfig): Promise<void>;
  function openPoolLedger(configName: string, config?: RuntimePoolConfig): Promise<PoolHandle>;
  function setProtocolVersion(version: number): Promise<void>;
  function buildGetNymRequest(submitterDid: Did | null, targetDid: Did): Promise<LedgerRequest>;
  function parseGetNymResponse(response: LedgerResponse): Promise<{}>;
  function buildSchemaRequest(submitterDid: Did, schema: Schema): Promise<LedgerRequest>;
  function buildGetSchemaRequest(submitterDid: Did, schemaId: SchemaId): Promise<LedgerRequest>;
  function parseGetSchemaResponse(response: LedgerResponse): Promise<[SchemaId, Schema]>;
  function buildCredDefRequest(submitterDid: Did, credDef: CredDef): Promise<LedgerRequest>;
  function buildGetCredDefRequest(submitterDid: Did, credDefId: CredDefId): Promise<LedgerRequest>;
  function parseGetCredDefResponse(response: LedgerResponse): Promise<[CredDefId, CredDef]>;
  function signRequest(wh: WalletHandle, myDid: Did, request: LedgerRequest): Promise<SignedLedgerRequest>;
  function submitRequest(poolHandle: PoolHandle, request: LedgerRequest): Promise<LedgerResponse>;
  function issuerCreateSchema(
    myDid: Did,
    name: string,
    version: string,
    attributes: string[]
  ): Promise<[SchemaId, Schema]>;
  function issuerCreateAndStoreCredentialDef(
    wh: WalletHandle,
    myDid: Did,
    schema: Schema,
    tag: string,
    signatureType: string,
    config: {}
  ): Promise<[CredDefId, CredDef]>;
}

type WalletHandle = number;
type SearchHandle = number;
type PoolHandle = number;
type Did = string;
type Verkey = string;
type ByteArray = number[];
type SchemaId = string;
type CredDefId = string;

interface LedgerRequest {
  reqId: number;
  identifier: string;
  operation: {};
  protocolVersion: number;
}

interface SignedLedgerRequest extends LedgerRequest {
  signature: string;
}

interface LedgerResponse {
  op: string;
  result: {};
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
  value: any;
  ver: string;
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
  tags?: {};
}

interface WalletRecordSearch {
  totalCount: string | null;
  records: WalletRecord[];
}
