import { type IssuerAuth, type IssuerAuthVerificationResult, type MdocFetchContext, MediaTypes } from '@owf/mdoc'
import { MediaTypes as TokenStatusListMediaTypes } from '@owf/token-status-list'
import type { AgentContext } from '../../agent'
import { dateToSeconds, TypedArrayEncoder } from '../../utils'
import {
  type CachedStatusListType,
  getCachedStatusList,
  setCachedStatusList,
  setCachedStatusListJwt,
} from '../token-status-list/statusListCache'

/** Status and identifier lists fetched during one verification, by fetch context type and uri. */
export type FetchedMdocStatusLists = Map<string, Uint8Array>

/**
 * Fetch a status or identifier list of an mdoc, from the cache when possible. A fetched list is added to
 * `fetched`, to cache it once verified with {@link cacheVerifiedMdocStatusLists}.
 */
export async function fetchMdocStatusList(
  agentContext: AgentContext,
  uri: string,
  context: MdocFetchContext,
  fetch: () => Promise<Response>,
  fetched?: FetchedMdocStatusLists
): Promise<Response> {
  const cached = await getCachedMdocStatusList(agentContext, context, uri)
  if (cached) return new Response(cached.body, { headers: { 'Content-Type': cached.contentType } })

  const response = await fetch()
  if (!fetched || !response.ok) return response

  const body = new Uint8Array(await response.arrayBuffer())
  fetched.set(`${context.type}:${uri}`, body)
  return new Response(body, { status: response.status, headers: response.headers })
}

async function getCachedMdocStatusList(agentContext: AgentContext, { type }: MdocFetchContext, uri: string) {
  if (type === 'identifierList') {
    const cwt = await getCachedStatusList(agentContext, 'identifierListCwt', uri)
    return cwt ? { body: TypedArrayEncoder.fromBase64Url(cwt), contentType: MediaTypes.IdentifierListCwt } : null
  }

  const cwt = await getCachedStatusList(agentContext, 'statusListCwt', uri)
  if (cwt) return { body: TypedArrayEncoder.fromBase64Url(cwt), contentType: TokenStatusListMediaTypes.StatusListCwt }

  // A status list served as a JWT, shared with the status lists of SD-JWT VCs
  const jwt = await getCachedStatusList(agentContext, 'statusListJwt', uri)
  return jwt ? { body: jwt, contentType: TokenStatusListMediaTypes.StatusListJwt } : null
}

/**
 * Cache the lists in `fetched` that the verification of an mdoc verified. Only call this once the mdoc
 * passed all checks, including the ones Credo makes on top of the library.
 */
export async function cacheVerifiedMdocStatusLists(
  agentContext: AgentContext,
  fetched: FetchedMdocStatusLists,
  issuerAuth: IssuerAuth,
  {
    statusList,
    trustedStatusListChain,
    identifierList,
  }: Pick<IssuerAuthVerificationResult, 'statusList' | 'trustedStatusListChain' | 'identifierList'>
) {
  const status = issuerAuth.mobileSecurityObject.status

  const statusListUri = status?.statusList?.uri
  const statusListToken = fetched.get(`statusList:${statusListUri}`)
  if (statusListUri && statusListToken) {
    if (statusList) {
      await setCachedCwt(agentContext, 'statusListCwt', statusListUri, statusListToken, statusList.payload)
    } else if (trustedStatusListChain) {
      // The library returns only the signer chain of a status list served as a JWT, which Credo always validates.
      // Once a release of @owf/mdoc returns `statusListJwt` (identity-common-ts@TimoGlastra/mdoc-status-list-jwt), use that.
      await setCachedStatusListJwt(agentContext, statusListUri, TypedArrayEncoder.toUtf8String(statusListToken))
    }
  }

  const identifierListUri = status?.identifierList?.uri
  const identifierListToken = fetched.get(`identifierList:${identifierListUri}`)
  if (identifierListUri && identifierListToken && identifierList) {
    await setCachedCwt(
      agentContext,
      'identifierListCwt',
      identifierListUri,
      identifierListToken,
      identifierList.payload
    )
  }
}

function setCachedCwt(
  agentContext: AgentContext,
  type: CachedStatusListType,
  uri: string,
  token: Uint8Array,
  payload: { expirationTime?: Date; timeToLive?: number }
) {
  return setCachedStatusList(agentContext, type, uri, TypedArrayEncoder.toBase64Url(token), {
    exp: payload.expirationTime ? dateToSeconds(payload.expirationTime) : undefined,
    ttl: payload.timeToLive,
  })
}
