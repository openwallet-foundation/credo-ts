import type { AbstractCheqdSDKModule, CheqdSDK, DidStdFee, DIDDocument } from '@cheqd/sdk'
import type { SignInfo } from '@cheqd/ts-proto/cheqd/did/v2'
import type { MsgCreateResourcePayload } from '@cheqd/ts-proto/cheqd/resource/v2'
import type { DirectSecp256k1HdWallet, DirectSecp256k1Wallet } from '@cosmjs/proto-signing'

import { injectable } from '@aries-framework/core'
import { createCheqdSDK, DIDModule, ResourceModule, CheqdNetwork } from '@cheqd/sdk'

import { CheqdModuleConfig } from '../CheqdModuleConfig'
import { parseCheqdDid } from '../anoncreds/utils/identifiers'
import { getCosmosPayerWallet } from '../dids/didCheqdUtil'

export interface ICheqdLedgerConfig {
  network: string
  rpcUrl: string
  readonly cosmosPayerWallet: Promise<DirectSecp256k1HdWallet | DirectSecp256k1Wallet>
  sdk?: CheqdSDK
}

export enum DefaultRPCUrl {
  Mainnet = 'https://rpc.cheqd.net',
  Testnet = 'https://rpc.cheqd.network',
}

@injectable()
export class CheqdLedgerService {
  private networks: ICheqdLedgerConfig[]

  public constructor(cheqdSdkModuleConfig: CheqdModuleConfig) {
    this.networks = cheqdSdkModuleConfig.networks.map((config) => {
      const { network, rpcUrl, cosmosPayerSeed } = config
      return {
        network,
        rpcUrl: rpcUrl ? rpcUrl : network === CheqdNetwork.Mainnet ? DefaultRPCUrl.Mainnet : DefaultRPCUrl.Testnet,
        cosmosPayerWallet: getCosmosPayerWallet(cosmosPayerSeed),
      }
    })
  }

  public async connect() {
    for (const network of this.networks) {
      network.sdk = await createCheqdSDK({
        modules: [DIDModule as unknown as AbstractCheqdSDKModule, ResourceModule as unknown as AbstractCheqdSDKModule],
        rpcUrl: network.rpcUrl,
        wallet: await network.cosmosPayerWallet.catch(() => {
          throw new Error(`[did-provider-cheqd]: valid cosmosPayerSeed is required`)
        }),
      })
    }
  }

  private getSdk(did: string) {
    const parsedDid = parseCheqdDid(did)
    if (!parsedDid) {
      throw new Error('Invalid DID')
    }
    if (this.networks.length === 0) {
      throw new Error('No cheqd networks configured')
    }

    const network = this.networks.find((network) => network.network === parsedDid.network)
    if (!network || !network.sdk) {
      throw new Error('Network not configured')
    }
    return network.sdk
  }

  public async create(
    didPayload: DIDDocument,
    signInputs: SignInfo[],
    versionId?: string | undefined,
    fee?: DidStdFee
  ) {
    return await this.getSdk(didPayload.id).createDidDocTx(signInputs, didPayload, '', fee, undefined, versionId)
  }

  public async update(
    didPayload: DIDDocument,
    signInputs: SignInfo[],
    versionId?: string | undefined,
    fee?: DidStdFee
  ) {
    return await this.getSdk(didPayload.id).updateDidDocTx(signInputs, didPayload, '', fee, undefined, versionId)
  }

  public async deactivate(
    didPayload: DIDDocument,
    signInputs: SignInfo[],
    versionId?: string | undefined,
    fee?: DidStdFee
  ) {
    return await this.getSdk(didPayload.id).deactivateDidDocTx(signInputs, didPayload, '', fee, undefined, versionId)
  }

  public async resolve(did: string, version?: string) {
    return version ? await this.getSdk(did).queryDidDocVersion(did, version) : await this.getSdk(did).queryDidDoc(did)
  }

  public async resolveMetadata(did: string) {
    return await this.getSdk(did).queryAllDidDocVersionsMetadata(did)
  }

  public async createResource(
    did: string,
    resourcePayload: Partial<MsgCreateResourcePayload>,
    signInputs: SignInfo[],
    fee?: DidStdFee
  ) {
    return await this.getSdk(did).createLinkedResourceTx(signInputs, resourcePayload, '', fee, undefined)
  }

  public async resolveResource(did: string, collectionId: string, resourceId: string) {
    return await this.getSdk(did).queryLinkedResource(collectionId, resourceId)
  }

  public async resolveCollectionResources(did: string, collectionId: string) {
    return await this.getSdk(did).queryLinkedResources(collectionId)
  }

  public async resolveResourceMetadata(did: string, collectionId: string, resourceId: string) {
    return await this.getSdk(did).queryLinkedResourceMetadata(collectionId, resourceId)
  }
}
