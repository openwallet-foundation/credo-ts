import type {
  AbstractCheqdSDKModule,
  CheqdSDK,
  DIDDocument,
  DIDDocumentWithMetadata,
  DidExtension,
  DidFeeOptions,
  DidStdFee,
  ResourceExtension,
} from '@cheqd/sdk'
import {
  CheqdNetwork,
  CheqdQuerier,
  createCheqdSDK,
  DIDModule,
  defaultDidExtensionKey,
  defaultResourceExtensionKey,
  ResourceModule,
  setupDidExtension,
  setupResourceExtension,
} from '@cheqd/sdk'
import type { QueryAllDidDocVersionsMetadataResponse, SignInfo } from '@cheqd/ts-proto/cheqd/did/v2'
import type {
  Metadata,
  MsgCreateResourcePayload,
  QueryCollectionResourcesResponse,
  ResourceWithMetadata,
} from '@cheqd/ts-proto/cheqd/resource/v2'
import type { DeliverTxResponse } from '@cosmjs/stargate'
import type { DidDocumentMetadata } from '@credo-ts/core'
import { CredoError, InjectionSymbols, inject, injectable, type Logger } from '@credo-ts/core'
import { parseCheqdDid } from '../anoncreds/utils/identifiers'
import { CheqdModuleConfig } from '../CheqdModuleConfig'
import { getCosmosPayerWallet } from '../dids/didCheqdUtil'

export interface ICheqdLedgerConfig {
  network: string
  rpcUrl: string
  cosmosPayerSeed?: string
  querier?: Promise<CheqdQuerier & DidExtension & ResourceExtension>
  sdk?: Promise<CheqdSDK>
}

export enum DefaultRPCUrl {
  Mainnet = 'https://rpc.cheqd.net',
  Testnet = 'https://rpc.cheqd.network',
}

@injectable()
export class CheqdLedgerService {
  private networks: ICheqdLedgerConfig[]
  private logger: Logger

  public constructor(cheqdSdkModuleConfig: CheqdModuleConfig, @inject(InjectionSymbols.Logger) logger: Logger) {
    this.logger = logger
    this.networks = cheqdSdkModuleConfig.networks.map((config) => {
      const { network, rpcUrl, cosmosPayerSeed } = config
      return {
        network,
        rpcUrl: rpcUrl ? rpcUrl : network === CheqdNetwork.Mainnet ? DefaultRPCUrl.Mainnet : DefaultRPCUrl.Testnet,
        cosmosPayerSeed,
      }
    })
  }

  // Connects only the querier. The SDK needs the payer wallet, so it's created on the first ledger write.
  public async connect() {
    for (const network of this.networks) {
      await this.getQuerier(network).catch((error) => {
        this.logger.error(`Skipping connection for network ${network.network} in cheqd sdk: ${error.message}`)
      })
    }
  }

  public async disconnect() {
    for (const network of this.networks) {
      const _a = await network.sdk
      if (!network.sdk) {
        await this.initializeSdkForNetwork(network)
      } else {
        this.logger.debug(`Not connecting to network ${network} as SDK already initialized`)
      }
    }
  }

  private getNetwork(did: string) {
    const parsedDid = parseCheqdDid(did)
    if (!parsedDid) {
      throw new Error('Invalid DID')
    }
    if (this.networks.length === 0) {
      throw new Error('No cheqd networks configured')
    }

    const network = this.networks.find((network) => network.network === parsedDid.network)
    if (!network) {
      throw new Error(`Network ${network} not found in cheqd networks configuration`)
    }

    return network
  }

  private async getQuerier(network: ICheqdLedgerConfig) {
    network.querier ??= CheqdQuerier.connectWithExtensions(
      network.rpcUrl,
      setupDidExtension,
      setupResourceExtension
    ) as Promise<CheqdQuerier & DidExtension & ResourceExtension>

    try {
      return await network.querier
    } catch (error) {
      network.querier = undefined
      throw new CredoError(`Error connecting to cheqd network ${network.network}: ${error.message}`, { cause: error })
    }
  }

  private async getSdk(did: string) {
    const network = this.getNetwork(did)

    if (!network.sdk) {
      const sdk = await this.initializeSdkForNetwork(network)
      if (!sdk) throw new Error(`Cheqd SDK not initialized for network ${network.network}`)
      return sdk
    }

    try {
      const sdk = await network.sdk
      return sdk
    } catch (error) {
      throw new Error(`Error initializing cheqd sdk for network ${network.network}: ${error.message}`)
    }
  }

  private async initializeSdkForNetwork(network: ICheqdLedgerConfig) {
    try {
      // Initialize cheqd sdk with promise
      network.sdk = createCheqdSDK({
        modules: [DIDModule as unknown as AbstractCheqdSDKModule, ResourceModule as unknown as AbstractCheqdSDKModule],
        rpcUrl: network.rpcUrl,
        wallet: await getCosmosPayerWallet(network.cosmosPayerSeed).catch((error) => {
          throw new CredoError(`Error initializing cosmos payer wallet: ${error.message}`, { cause: error })
        }),
      })

      return await network.sdk
    } catch (error) {
      this.logger.error(
        `Skipping connection for network ${network.network} in cheqd sdk due to error in initialization: ${error.message}`
      )
      network.sdk = undefined
      return undefined
    }
  }

  public async create(
    didPayload: DIDDocument,
    signInputs: SignInfo[],
    versionId?: string | undefined,
    fee?: DidStdFee,
    feeOptions?: DidFeeOptions
  ): Promise<DeliverTxResponse> {
    const sdk = await this.getSdk(didPayload.id)
    return sdk.createDidDocTx(
      signInputs,
      didPayload,
      '',
      fee,
      undefined,
      versionId,
      feeOptions || { slippageBps: 1000 }
    )
  }

  public async update(
    didPayload: DIDDocument,
    signInputs: SignInfo[],
    versionId?: string | undefined,
    fee?: DidStdFee,
    feeOptions?: DidFeeOptions
  ): Promise<DeliverTxResponse> {
    const sdk = await this.getSdk(didPayload.id)
    return sdk.updateDidDocTx(
      signInputs,
      didPayload,
      '',
      fee,
      undefined,
      versionId,
      feeOptions || { slippageBps: 1000 }
    )
  }

  public async deactivate(
    didPayload: DIDDocument,
    signInputs: SignInfo[],
    versionId?: string | undefined,
    fee?: DidStdFee,
    feeOptions?: DidFeeOptions
  ): Promise<DeliverTxResponse> {
    const sdk = await this.getSdk(didPayload.id)
    return sdk.deactivateDidDocTx(
      signInputs,
      didPayload,
      '',
      fee,
      undefined,
      versionId,
      feeOptions || { slippageBps: 1000 }
    )
  }

  public async resolve(did: string, version?: string): Promise<DIDDocumentWithMetadata> {
    const querier = await this.getQuerier(this.getNetwork(did))
    const { didDoc, metadata } = version
      ? await querier[defaultDidExtensionKey].didDocVersion(did, version)
      : await querier[defaultDidExtensionKey].didDoc(did)
    if (!didDoc || !metadata) throw new CredoError(`No DID document found for ${did}`)

    return {
      didDocument: await DIDModule.toSpecCompliantPayload(didDoc),
      didDocumentMetadata: await DIDModule.toSpecCompliantMetadata(metadata),
    }
  }

  public async resolveMetadata(did: string): Promise<{
    didDocumentVersionsMetadata: DidDocumentMetadata[]
    pagination: QueryAllDidDocVersionsMetadataResponse['pagination']
  }> {
    const querier = await this.getQuerier(this.getNetwork(did))
    const { versions, pagination } = await querier[defaultDidExtensionKey].allDidDocVersionsMetadata(did)
    return {
      didDocumentVersionsMetadata: await Promise.all(versions.map((m) => DIDModule.toSpecCompliantMetadata(m))),
      pagination,
    }
  }

  public async createResource(
    did: string,
    resourcePayload: Partial<MsgCreateResourcePayload>,
    signInputs: SignInfo[],
    fee?: DidStdFee,
    feeOptions?: DidFeeOptions
  ): Promise<DeliverTxResponse> {
    const sdk = await this.getSdk(did)
    return sdk.createLinkedResourceTx(
      signInputs,
      resourcePayload,
      '',
      fee,
      undefined,
      feeOptions || { slippageBps: 1000 }
    )
  }

  public async resolveResource(did: string, collectionId: string, resourceId: string): Promise<ResourceWithMetadata> {
    const querier = await this.getQuerier(this.getNetwork(did))
    return querier[defaultResourceExtensionKey].resource(collectionId, resourceId)
  }

  public async resolveCollectionResources(
    did: string,
    collectionId: string
  ): Promise<QueryCollectionResourcesResponse> {
    const querier = await this.getQuerier(this.getNetwork(did))
    return querier[defaultResourceExtensionKey].collectionResources(collectionId)
  }

  public async resolveResourceMetadata(did: string, collectionId: string, resourceId: string): Promise<Metadata> {
    const querier = await this.getQuerier(this.getNetwork(did))
    return querier[defaultResourceExtensionKey].resourceMetadata(collectionId, resourceId)
  }
}
