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
}

type WalletHandle = number;
type Did = string;
type Verkey = string;
type ByteArray = number[];

interface KeyConfig {
  seed?: string;
}
