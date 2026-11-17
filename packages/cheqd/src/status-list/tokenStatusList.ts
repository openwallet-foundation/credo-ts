import type { DidFeeOptions, DidStdFee } from '@cheqd/sdk'
import type { AgentContext, CustomStatusListFetcher } from '@credo-ts/core'
import { CredoError, TypedArrayEncoder, utils } from '@credo-ts/core'

import { parseCheqdDid } from '../anoncreds/utils/identifiers'
import { CheqdDidRegistrar } from '../dids'
import { CheqdLedgerService } from '../ledger'

/** The resource type cheqd Studio documents for Token Status Lists. A resource of this type holds a JWT or a CWT. */
export const tokenStatusListResourceType = 'TokenStatusList'

/** The public cheqd resolver, which serves a linked resource at an https url, as status list clients require */
export const defaultTokenStatusListResolverUrl = 'https://resolver.cheqd.net/1.0/identifiers/'

export interface TokenStatusListUriOptions {
  did: string
  /** Name of the linked resource. Every update of the list is a new version under the same name. */
  name: string
  /** Base url of a cheqd resolver, ending in `/identifiers/`. Defaults to the public resolver. */
  resolverUrl?: string
}

/**
 * The stable uri of a Token Status List, for the `status_list.uri` claim of credentials and the `sub` of the list.
 * It resolves to the latest version of the list, so it does not change when the list is updated.
 */
export function getTokenStatusListUri({
  did,
  name,
  resolverUrl = defaultTokenStatusListResolverUrl,
}: TokenStatusListUriOptions) {
  if (!parseCheqdDid(did)) throw new CredoError(`'${did}' is not a valid did:cheqd did`)
  const base = resolverUrl.endsWith('/') ? resolverUrl : `${resolverUrl}/`
  return `${base}${did}?resourceName=${encodeURIComponent(name)}&resourceType=${tokenStatusListResourceType}`
}

/**
 * Reads a Token Status List uri written by {@link getTokenStatusListUri}: either the https url of a cheqd resolver
 * or the did url itself. Returns `null` for any other uri, and for uris that pin a version or a time.
 */
export function parseTokenStatusListUri(uri: string): { did: string; name: string } | null {
  const didUrl = uri.startsWith('did:cheqd:')
    ? uri
    : uri.match(/^https?:\/\/[^?#]+\/1\.0\/identifiers\/(did:cheqd:[^#]*)$/)?.[1]
  if (!didUrl) return null

  const [did, query] = didUrl.split('?')
  if (!query || !parseCheqdDid(did)) return null

  const params: Record<string, string> = {}
  for (const pair of query.split('&')) {
    const index = pair.indexOf('=')
    if (index === -1) return null
    try {
      params[decodeURIComponent(pair.slice(0, index))] = decodeURIComponent(pair.slice(index + 1))
    } catch {
      return null
    }
  }

  if (params.resourceType !== tokenStatusListResourceType || !params.resourceName) return null
  if (params.version || params.resourceVersionTime) return null
  return { did, name: params.resourceName }
}

export interface PublishTokenStatusListOptions {
  /** The signed list: a JWT as a string, or a CWT as bytes */
  statusList: string | Uint8Array
  /** Name of the linked resource, see {@link TokenStatusListUriOptions.name} */
  name: string
  /** Version label of this version of the list. Defaults to the current time. */
  version?: string
  /** Fee for the transaction. Defaults to the SDK's. */
  fee?: DidStdFee
  /** Set `gasLimit` for a list over about 20 KB: the SDK's default is 1,000,000 gas and a list costs about 41 gas per byte */
  feeOptions?: DidFeeOptions
}

/** Publishes a signed Token Status List as a new version of a linked resource of the did. The did must be controlled by this agent. */
export async function publishTokenStatusList(
  agentContext: AgentContext,
  did: string,
  options: PublishTokenStatusListOptions
) {
  const registrar = agentContext.dependencyManager.resolve(CheqdDidRegistrar)
  const resourceId = utils.uuid()
  const result = await registrar.createResource(agentContext, did, {
    id: resourceId,
    name: options.name,
    resourceType: tokenStatusListResourceType,
    version: options.version ?? new Date().toISOString(),
    fee: options.fee,
    feeOptions: options.feeOptions,
    // As bytes: a string would be decoded as base64
    data:
      typeof options.statusList === 'string'
        ? TypedArrayEncoder.fromUtf8String(options.statusList)
        : options.statusList,
  })

  if (result.resourceState.state !== 'finished') {
    throw new CredoError(`Unable to publish the token status list: ${result.resourceState.reason}`)
  }
  return { resourceId }
}

export type FetchedTokenStatusList =
  | { format: 'jwt'; statusList: string; resourceId: string; version: string }
  | { format: 'cwt'; statusList: Uint8Array; resourceId: string; version: string }

/** Reads the latest version of a Token Status List from the ledger, one request, and tells a JWT from a CWT by its content */
export async function fetchTokenStatusList(
  agentContext: AgentContext,
  options: { did: string; name: string }
): Promise<FetchedTokenStatusList> {
  const parsed = parseCheqdDid(options.did)
  if (!parsed) throw new CredoError(`'${options.did}' is not a valid did:cheqd did`)

  const ledger = agentContext.dependencyManager.resolve(CheqdLedgerService)
  const { resource, metadata } = await ledger.resolveLatestResource(
    parsed.did,
    parsed.id,
    options.name,
    tokenStatusListResourceType
  )
  if (!resource || !metadata) throw new CredoError(`Token status list '${options.name}' of ${options.did} not found`)

  const base = { resourceId: metadata.id, version: metadata.version }
  return isCoseSign1(resource.data)
    ? { ...base, format: 'cwt', statusList: resource.data }
    : { ...base, format: 'jwt', statusList: TypedArrayEncoder.toUtf8String(resource.data).trim() }
}

/**
 * A `customStatusListFetcher` for the `SdJwtVcModule` that reads Token Status Lists published as cheqd linked
 * resources straight from the ledger, and leaves every other uri to the default https fetcher.
 *
 * It is given the agent context lazily, because the module config is built before the agent exists:
 * `createCheqdStatusListFetcher(() => agent.context)`.
 */
export function createCheqdStatusListFetcher(getAgentContext: () => AgentContext): CustomStatusListFetcher {
  return async (uri, { defaultFetcher }) => {
    const parsed = parseTokenStatusListUri(uri)
    if (!parsed) return await defaultFetcher()

    const list = await fetchTokenStatusList(getAgentContext(), parsed)
    if (list.format !== 'jwt')
      throw new CredoError('An SD-JWT VC status list must be a JWT, but the resource holds a CWT')
    return list.statusList
  }
}

/** A CWT is a CBOR COSE_Sign1: the four element array 0x84, optionally behind tag 18 (0xD2), then the protected header as a byte string */
function isCoseSign1(data: Uint8Array) {
  const start = data[0] === 0xd2 ? 1 : 0
  return data.length > start + 1 && data[start] === 0x84 && data[start + 1] >= 0x40 && data[start + 1] <= 0x5f
}
