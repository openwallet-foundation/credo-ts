import type { PackedMessage, UnpackedMessageContext } from '../types'
import type { Buffer } from '../utils/buffer'
import type { DidConfig, Did, Verkey, WalletConfig, WalletCredentials } from 'indy-sdk'

export interface Wallet {
  publicDid: DidInfo | undefined
  isInitialized: boolean

  initialize(walletConfig: WalletConfig, walletCredentials: WalletCredentials): Promise<void>
  close(): Promise<void>
  delete(): Promise<void>

  initPublicDid(didConfig: DidConfig): Promise<void>
  createDid(didConfig?: DidConfig): Promise<[Did, Verkey]>
  pack(payload: Record<string, unknown>, recipientKeys: Verkey[], senderVk: Verkey | null): Promise<PackedMessage>
  unpack(messagePackage: PackedMessage): Promise<UnpackedMessageContext>
  sign(data: Buffer, verkey: Verkey): Promise<Buffer>
  verify(signerVerkey: Verkey, data: Buffer, signature: Buffer): Promise<boolean>
  generateNonce(): Promise<string>
}

export interface DidInfo {
  did: Did
  verkey: Verkey
}
