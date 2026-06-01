import { CoseKey } from '@owf/cose'
import {
  createHeaderAndPayload,
  fetchStatusList,
  getListFromStatusListJWT,
  StatusList,
  StatusListCwt,
  StatusListCwtPayload,
} from '@owf/token-status-list'
import type { AgentContext } from '../../agent'
import { type JwsProtectedHeaderOptions, JwsService, Jwt, JwtPayload } from '../../crypto'
import { getMac0Context } from '../../crypto/contexts/mac0Context'
import { getSign1Context } from '../../crypto/contexts/sign1Context'
import { CredoError } from '../../error'
import { injectable } from '../../plugins'
import { dateToSeconds } from '../../utils'
import { KeyManagementApi } from '../kms'
import type {
  CreateTokenStatusListOptions,
  FetchTokenStatusListOptions,
  StatusListInput,
  TokenStatusListFormat,
  TokenStatusListResult,
  TokenStatusListResultFor,
  UpdateTokenStatusListOptions,
} from './TokenStatusListOptions'

function emptyStatusList(input: Exclude<StatusListInput, StatusList>): StatusList {
  return new StatusList(new Array(input.statusListLength).fill(0), input.bitsPerStatus, input.aggregationUri)
}

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
    const statusList =
      options.statusList instanceof StatusList ? options.statusList : emptyStatusList(options.statusList)

    const now = options.now ?? new Date()
    const issuedAt = options.issuedAt ?? now

    const kms = agentContext.dependencyManager.resolve(KeyManagementApi)
    const jwk = await kms.getPublicKey({ keyId: options.keyId })
    if (!jwk.alg) {
      throw new CredoError(`Found JWK for key id '${options.keyId}', but did not find a required algorithm`)
    }

    if (options.format === 'cwt') {
      const cwtPayload = StatusListCwtPayload.create({
        subject: options.statusListUri,
        statusList,
        issuedAt,
        expirationTime: options.expiresAt,
        timeToLive: options.timeToLive,
      })
      const cwtFull = new StatusListCwt({ payload: cwtPayload })
      const shouldAuthenticate = jwk.alg?.toUpperCase().startsWith('HS')

      return {
        format: options.format,
        // Mac0 vs Sign1
        statusList: shouldAuthenticate
          ? await cwtFull.authenticateAndEncode({ key: CoseKey.fromJwk(jwk) }, getMac0Context(agentContext))
          : await cwtFull.signAndEncode({ signingKey: CoseKey.fromJwk(jwk) }, getSign1Context(agentContext)),
        parsed: cwtFull,
      } as Extract<TokenStatusListResult, { format: Format }>
    }

    if (options.format === 'jwt') {
      const basePayload: Record<string, unknown> = {
        ...options.additionalPayload,
        sub: options.statusListUri,
        iat: dateToSeconds(issuedAt),
      }
      if (options.expiresAt !== undefined) {
        basePayload.exp = dateToSeconds(options.expiresAt)
      }
      if (options.timeToLive !== undefined) {
        basePayload.ttl = options.timeToLive
      }

      const { header, payload } = createHeaderAndPayload(statusList, basePayload as { sub: string; iat: number }, {
        alg: jwk.alg,
        typ: 'statuslist+jwt',
      })
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

    const now = options.now ?? new Date()
    const issuedAt = options.issuedAt ?? now

    if (options.token instanceof Uint8Array) {
      const cwt = StatusListCwt.fromToken(options.token)
      if (Array.isArray(options.status)) {
        for (const { index, status } of options.status) {
          cwt.updateStatusList(index, status)
        }
      } else {
        cwt.updateStatusList(options.status.index, options.status.status)
      }

      // Apply updated timing claims
      const updatedPayload = StatusListCwtPayload.create({
        subject: cwt.payload.subject,
        statusList: cwt.payload.statusList,
        issuedAt,
        expirationTime: options.expiresAt ?? cwt.payload.expirationTime,
        timeToLive: options.timeToLive ?? cwt.payload.timeToLive,
      })
      const updatedCwt = new StatusListCwt({ payload: updatedPayload })

      const shouldAuthenticate = jwk.alg?.toUpperCase().startsWith('HS')
      if (shouldAuthenticate) {
        const mac0Context = getMac0Context(agentContext)
        return {
          statusList: await updatedCwt.authenticateAndEncode({ key: CoseKey.fromJwk(jwk) }, mac0Context),
          parsed: updatedCwt,
        }
      } else {
        const sign1Context = getSign1Context(agentContext)
        return {
          statusList: await updatedCwt.signAndEncode({ signingKey: CoseKey.fromJwk(jwk) }, sign1Context),
          parsed: updatedCwt,
        }
      }
    } else if (typeof options.token === 'string') {
      const statusList = getListFromStatusListJWT(options.token)
      const jwt = Jwt.fromSerializedJwt(options.token)

      if (Array.isArray(options.status)) {
        for (const { index, status } of options.status) {
          statusList.setStatus(index, status)
        }
      } else {
        statusList.setStatus(options.status.index, options.status.status)
      }

      // toJson() spreads additionalClaims first then overwrites with named fields (which may be undefined),
      // so we pull sub from additionalClaims explicitly to preserve it.
      const existingClaims = {
        ...jwt.payload.additionalClaims,
        ...(jwt.payload.iss !== undefined && { iss: jwt.payload.iss }),
        ...(jwt.payload.sub !== undefined && { sub: jwt.payload.sub }),
        ...(jwt.payload.aud !== undefined && { aud: jwt.payload.aud }),
        ...(jwt.payload.exp !== undefined && { exp: jwt.payload.exp }),
        ...(jwt.payload.nbf !== undefined && { nbf: jwt.payload.nbf }),
        ...(jwt.payload.jti !== undefined && { jti: jwt.payload.jti }),
      }
      const updatedPayload: Record<string, unknown> = {
        ...existingClaims,
        ...options.additionalPayload,
        iat: Math.floor(issuedAt.getTime() / 1000),
      }
      if (options.expiresAt !== undefined) {
        updatedPayload.exp = Math.floor(options.expiresAt.getTime() / 1000)
      }
      if (options.timeToLive !== undefined) {
        updatedPayload.ttl = options.timeToLive
      }

      // createHeaderAndPayload will overwrite status_list with the updated one
      const { header, payload } = createHeaderAndPayload(
        statusList,
        updatedPayload as { sub: string; iat: number },
        { ...jwt.header, alg: jwk.alg, typ: 'statuslist+jwt' } as {
          alg: string
          typ: 'statuslist+jwt'
        }
      )

      const jwsService = agentContext.dependencyManager.resolve(JwsService)
      const jws = await jwsService.createJwsCompact(agentContext, {
        payload: new JwtPayload({ additionalClaims: payload }),
        keyId: options.keyId,
        protectedHeaderOptions: header as JwsProtectedHeaderOptions,
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
