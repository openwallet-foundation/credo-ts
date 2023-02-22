import type { AbstractCheqdSDKModule, CheqdSDK, ICheqdSDKOptions, DidStdFee, DIDDocument } from '@cheqd/sdk'
import type { SignInfo } from '@cheqd/ts-proto/cheqd/did/v2'
import type { MsgCreateResourcePayload } from '@cheqd/ts-proto/cheqd/resource/v2'

import { injectable } from '@aries-framework/core'
import { createCheqdSDK, DIDModule, ResourceModule, CheqdNetwork } from '@cheqd/sdk'
import { DirectSecp256k1HdWallet, DirectSecp256k1Wallet } from '@cosmjs/proto-signing'
import { EnglishMnemonic as _ } from '@cosmjs/crypto'
import { fromString } from 'uint8arrays'

import { CheqdSdkModuleConfig } from '../CheqdSdkModuleConfig'

export interface CheqdSdkLedgerConfig {
  networkType?: CheqdNetwork
  rpcUrl?: string
  cosmosPayerSeed?: string
}

export enum DefaultRPCUrl {
  Mainnet = 'https://rpc.cheqd.net',
  Testnet = 'https://rpc.cheqd.network',
}

export class EnglishMnemonic extends _ {
  public static readonly _mnemonicMatcher = /^[a-z]+( [a-z]+)*$/
}

@injectable()
export class CheqdSdkLedgerService {
  private readonly cosmosPayerWallet: Promise<DirectSecp256k1HdWallet | DirectSecp256k1Wallet>
  private sdk?: CheqdSDK
  private fee?: DidStdFee
  private rpcUrl: string | undefined

  public constructor(config: CheqdSdkModuleConfig) {
    const { cosmosPayerSeed, rpcUrl } = config
    if (!cosmosPayerSeed || cosmosPayerSeed === '') {
      this.cosmosPayerWallet = DirectSecp256k1HdWallet.generate()
      return
    }
    this.cosmosPayerWallet = EnglishMnemonic._mnemonicMatcher.test(cosmosPayerSeed)
      ? DirectSecp256k1HdWallet.fromMnemonic(cosmosPayerSeed, { prefix: 'cheqd' })
      : DirectSecp256k1Wallet.fromKey(fromString(cosmosPayerSeed.replace(/^0x/, ''), 'hex'), 'cheqd')

    this.rpcUrl = rpcUrl
  }

  public async connect(options: { network?: string; fee?: DidStdFee } = {}) {
    const sdkOptions: ICheqdSDKOptions = {
      modules: [DIDModule as unknown as AbstractCheqdSDKModule, ResourceModule as unknown as AbstractCheqdSDKModule],
      rpcUrl: this.rpcUrl
        ? this.rpcUrl
        : options.network === CheqdNetwork.Mainnet
        ? DefaultRPCUrl.Mainnet
        : DefaultRPCUrl.Testnet,
      wallet: await this.cosmosPayerWallet.catch(() => {
        throw new Error(`[did-provider-cheqd]: valid cosmosPayerSeed is required`)
      }),
    }

    this.sdk = await createCheqdSDK(sdkOptions)
    this.fee = options.fee
  }

  private getSdk() {
    if (!this.sdk) {
      throw new Error('Connect to network')
    }
    return this.sdk
  }

  public async create(signInputs: SignInfo[], didPayload: DIDDocument, versionId?: string | undefined) {
    return await this.getSdk().createDidDocTx(signInputs, didPayload, '', this?.fee, undefined, versionId)
  }

  public async update(signInputs: SignInfo[], didPayload: DIDDocument, versionId?: string | undefined) {
    return await this.getSdk().updateDidDocTx(signInputs, didPayload, '', this?.fee, undefined, versionId)
  }

  public async deactivate(signInputs: SignInfo[], didPayload: DIDDocument, versionId?: string | undefined) {
    return await this.getSdk().deactivateDidDocTx(signInputs, didPayload, '', this?.fee, undefined, versionId)
  }

  public async resolve(did: string, version?: string) {
    return version ? await this.getSdk().queryDidDocVersion(did, version) : await this.sdk!.queryDidDoc(did)
  }

  public async resolveMetadata(did: string) {
    return await this.getSdk().queryAllDidDocVersionsMetadata(did)
  }

  public async createResource(signInputs: SignInfo[], resourcePayload: Partial<MsgCreateResourcePayload>) {
    return await this.getSdk().createLinkedResourceTx(signInputs, resourcePayload, '', this?.fee, undefined)
  }

  public async resolveResource(collectionId: string, resourceId: string) {
    return await this.getSdk().queryLinkedResource(collectionId, resourceId)
  }

  public async resolveCollectionResources(collectionId: string) {
    return await this.getSdk().queryLinkedResources(collectionId)
  }

  public async resolveResourceMetadata(collectionId: string, resourceId: string) {
    return await this.getSdk().queryLinkedResourceMetadata(collectionId, resourceId)
  }
}
