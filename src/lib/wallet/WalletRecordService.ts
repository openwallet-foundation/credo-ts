export interface WalletRecordService {
  add(walletHandle: WalletHandle, record: WalletRecord): Promise<void>;

  // addWalletRecord(walletHandle: WalletHandle, type: string, id: string, value: string, tags: string | object) : Promise<void>

  update(walletHandle: WalletHandle, record: WalletRecord): Promise<void>;

  // updateWalletRecord(walletHandle: WalletHandle, type: string, id: string, value: string): Promise<void>

  // updateWalletRecordTags(walletHandle: WalletHandle, type: string, id: string, tags: string | object): Promise<void>

  // addWalletRecordTags(walletHandle: WalletHandle, type: string, id: string, tags: string | object) : Promise<void>

  // deleteWalletRecordTags(walletHandle: WalletHandle, type: string, id: string, tagNames: Array<string>) : Promise<void>

  delete(walletHandle: WalletHandle, id: string): Promise<boolean>;

  // deleteWalletRecord(walletHandle: WalletHandle, type: string, id: string): Promise<void>

  get(walletHandle: WalletHandle, id: string): Promise<WalletRecord>;

  // getWalletRecord(walletHandle: WalletHandle, type: string, id: string, options: WalletRecordOptions): Promise<WalletRecord>
}

export interface WalletRecordOptions {
  retrieveType?: boolean;
  retrieveValue?: boolean;
  retrieveTags?: boolean;
}

export interface WalletRecord {
  id: string;
  type?: string;
  value?: string;
  tags?: string | object;
}
