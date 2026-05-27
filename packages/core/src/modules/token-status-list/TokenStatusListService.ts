import { CoseKey } from '@owf/cose'
import {
  createHeaderAndPayload,
  fetchStatusList,
  getListFromStatusListJWT,
  StatusList,
  StatusListCwt,
} from '@owf/token-status-list'
import type { AgentContext } from '../../agent'
import { type JwsProtectedHeaderOptions, JwsService, Jwt, JwtPayload } from '../../crypto'
import { CredoError } from '../../error'
import { injectable } from '../../plugins'
import { KeyManagementApi } from '../kms'
import { getMac0Context } from './context/mac0Context'
import { getSign1Context } from './context/sign1Context'
import type {
  CreateTokenStatusListOptions,
  FetchTokenStatusListOptions,
  TokenStatusListFormat,
  TokenStatusListResult,
  TokenStatusListResultFor,
  UpdateTokenStatusListOptions,
} from './TokenStatusListOptions'

export { StatusListCwt, type StatusListCwtOptions } from '@owf/token-status-list'

/**
 * @internal
 *
 * @todo with what value should we initialize the array? Valid or Invalid?
 */
@injectable()
export class TokenStatusListService {
  public async createTokenStatusList<Format extends TokenStatusListFormat>(
    agentContext: AgentContext,
    options: CreateTokenStatusListOptions<Format>
  ): Promise<Extract<TokenStatusListResult, { format: Format }>> {
    const statusList = new StatusList(
      new Array(options.statusListLength).fill(0),
      options.bitsPerStatus,
      options.aggregationUri
    )
    const kms = agentContext.dependencyManager.resolve(KeyManagementApi)
    const jwk = await kms.getPublicKey({ keyId: options.keyId })
    if (!jwk.alg) {
      throw new CredoError(`Found JWK for key id '${options.keyId}', but did not find a required algorithm`)
    }
    if (options.format === 'cwt') {
      const cwt = StatusListCwt.createFromStatusListAndSubject(statusList, options.statusListUri)
      const shouldAuthenticate = jwk.alg?.toUpperCase().startsWith('HS')
      if (shouldAuthenticate) {
        const mac0Context = getMac0Context(agentContext)
        return {
          format: options.format,
          statusList: await cwt.authenticateAndEncode({ key: CoseKey.fromJwk(jwk) }, mac0Context),
          parsed: cwt,
        } as Extract<TokenStatusListResult, { format: Format }>
      } else {
        const sign1Context = getSign1Context(agentContext)
        return {
          format: options.format,
          statusList: await cwt.signAndEncode({ signingKey: CoseKey.fromJwk(jwk) }, sign1Context),
          parsed: cwt,
        } as Extract<TokenStatusListResult, { format: Format }>
      }
    }

    if (options.format === 'jwt') {
      const { header, payload } = createHeaderAndPayload(
        statusList,
        { cnf: { jwk } },
        { alg: jwk.alg, typ: 'statuslist+jwt' }
      )
      const jwsService = agentContext.dependencyManager.resolve(JwsService)
      const jws = await jwsService.createJwsCompact(agentContext, {
        payload: new JwtPayload({ additionalClaims: payload }),
        keyId: options.keyId,
        protectedHeaderOptions: header as JwsProtectedHeaderOptions,
      })
      return {
        format: 'jwt',
        statusList: jws,
        parsed: Jwt.fromSerializedJwt(jws),
      } as Extract<TokenStatusListResult, { format: Format }>
    }

    throw new CredoError(`Could not create token status list with format '${options.format}'`)
  }

  public async updateTokenStatusList(
    agentContext: AgentContext,
    options: UpdateTokenStatusListOptions<string>
  ): Promise<{ statusList: string; parsed: Jwt }>
  public async updateTokenStatusList(
    agentContext: AgentContext,
    options: UpdateTokenStatusListOptions<Uint8Array>
  ): Promise<{ statusList: Uint8Array; parsed: StatusListCwt }>
  public async updateTokenStatusList(
    agentContext: AgentContext,
    options: UpdateTokenStatusListOptions<Uint8Array | string>
  ): Promise<{ statusList: Uint8Array | string; parsed: StatusListCwt | Jwt }> {
    const kms = agentContext.dependencyManager.resolve(KeyManagementApi)
    const jwk = await kms.getPublicKey({ keyId: options.keyId })
    if (!jwk.alg) {
      throw new CredoError(`Found JWK for key id '${options.keyId}', but did not find a required algorithm`)
    }
    if (options.token instanceof Uint8Array) {
      const cwt = StatusListCwt.fromToken(options.token)
      if (Array.isArray(options.status)) {
        for (const { index, status } of options.status) {
          cwt.updateStatusList(index, status)
        }
      } else {
        cwt.updateStatusList(options.status.index, options.status.status)
      }
      const shouldAuthenticate = jwk.alg?.toUpperCase().startsWith('HS')
      if (shouldAuthenticate) {
        const mac0Context = getMac0Context(agentContext)
        return { statusList: await cwt.authenticateAndEncode({ key: CoseKey.fromJwk(jwk) }, mac0Context), parsed: cwt }
      } else {
        const sign1Context = getSign1Context(agentContext)
        return { statusList: await cwt.signAndEncode({ signingKey: CoseKey.fromJwk(jwk) }, sign1Context), parsed: cwt }
      }
    } else if (typeof options.token === 'string') {
      // TODO: we need to update the token-status-list library JWT code to be in sync with CWT
      const statusList = getListFromStatusListJWT(options.token)
      const jwt = Jwt.fromSerializedJwt(options.token)
      if (Array.isArray(options.status)) {
        for (const { index, status } of options.status) {
          statusList.setStatus(index, status)
        }
      } else {
        statusList.setStatus(options.status.index, options.status.status)
      }
      const jwsService = agentContext.dependencyManager.resolve(JwsService)
      const jws = await jwsService.createJwsCompact(agentContext, {
        payload: new JwtPayload({ additionalClaims: { ...jwt, status_list: statusList } }),
        keyId: options.keyId,
        protectedHeaderOptions: jwt.header as JwsProtectedHeaderOptions,
      })
      return {
        statusList: jws,
        parsed: Jwt.fromSerializedJwt(jws),
      }
    }

    throw new CredoError(`Could not update status list in token for token '${options.token}'`)
  }

  public async fetchTokenStatusList<AcceptedFormats extends TokenStatusListFormat>(
    agentContext: AgentContext,
    options: FetchTokenStatusListOptions<AcceptedFormats>
  ): Promise<TokenStatusListResultFor<AcceptedFormats>> {
    const token = await fetchStatusList({
      uri: options.uri,
      acceptedFormats: options.acceptedFormats,
      customFetcher: agentContext.config.agentDependencies.fetch,
    })

    if (token instanceof Uint8Array) {
      return {
        format: 'cwt',
        statusList: token,
        parsed: StatusListCwt.fromToken(token),
      } as TokenStatusListResultFor<AcceptedFormats>
    }

    if (typeof token === 'string') {
      return {
        format: 'jwt',
        statusList: token,
        parsed: Jwt.fromSerializedJwt(token),
      } as TokenStatusListResultFor<AcceptedFormats>
    }

    throw new CredoError(`Could not parse token from URL '${options.uri}'`)
  }
}
