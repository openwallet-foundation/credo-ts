import { CoseKey, jwkToCoseKey, RegisteredCwtHeaderClaimKey, SignatureAlgorithm } from '@owf/cose'
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
import { DidsApi } from '../dids'
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
    options: CreateTokenStatusListOptions
  ): Promise<Extract<TokenStatusListResult, { format: Format }>> {
    // TODO: jwk could also be supported
    if (options.signer.method !== 'x5c' && options.signer.method !== 'did') {
      throw new Error(
        `signer method '${options.signer.method}' is not supported for creating a token status list. Only x5c is`
      )
    }

    let keyId: string | undefined
    if (options.signer.method === 'x5c') {
      keyId = options.signer.x5c[0].keyId
    } else if (options.signer.method === 'did') {
      const dids = agentContext.dependencyManager.resolve(DidsApi)
      const { publicJwk } = await dids.resolveVerificationMethodFromCreatedDidRecord(options.signer.didUrl)
      keyId = publicJwk.keyId
    }

    if (!keyId) {
      throw new CredoError(
        `Unable to establish key id for signer method '${options.signer.method}' when creating a token status list`
      )
    }

    const statusList =
      options.statusList instanceof StatusList ? options.statusList : emptyStatusList(options.statusList)

    const now = options.now ?? new Date()
    const issuedAt = options.issuedAt ?? now

    const kms = agentContext.dependencyManager.resolve(KeyManagementApi)
    const jwk = await kms.getPublicKey({ keyId })

    try {
      if (options.format === 'cwt') {
        if (options.signer.method !== 'x5c') {
          throw new CredoError('For a CWT Token Status List, only a signer of type x5c is supported.')
        }
        const cwtPayload = StatusListCwtPayload.create({
          subject: options.statusListUri,
          statusList,
          issuedAt,
          expirationTime: options.expiresAt,
          timeToLive: options.timeToLive,
          additionalClaims: options.additionalPayload,
        })
        const cwtFull = new StatusListCwt({
          payload: cwtPayload,
          protectedHeaders: new Map<number, unknown>([
            [RegisteredCwtHeaderClaimKey.X5Chain, options.signer.x5c.map((cert) => cert.rawCertificate)],
            [RegisteredCwtHeaderClaimKey.Algorithm, jwkToCoseKey.alg(options.alg)],
          ]),
        })
        const shouldAuthenticate = jwk.alg?.toUpperCase().startsWith('HS')

        return {
          format: options.format,
          // Mac0 vs Sign1
          statusList: shouldAuthenticate
            ? await cwtFull.authenticateAndEncode({ key: CoseKey.fromJwk(jwk) }, getMac0Context(agentContext))
            : await cwtFull.signAndEncode(
                { signingKey: CoseKey.fromJwk(jwk), algorithm: jwkToCoseKey.alg(options.alg) as SignatureAlgorithm },
                getSign1Context(agentContext)
              ),
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
          alg: options.alg,
          typ: 'statuslist+jwt',
        })
        const headerWithKeyReference = {
          ...header,
          ...(options.signer.method === 'x5c'
            ? { x5c: options.signer.x5c.map((cert) => cert.toString('base64')) }
            : {}),
          ...(options.signer.method === 'did' ? { kid: options.signer.didUrl } : {}),
        }

        const jwsService = agentContext.dependencyManager.resolve(JwsService)
        const jws = await jwsService.createJwsCompact(agentContext, {
          payload: new JwtPayload({ additionalClaims: payload }),
          keyId,
          protectedHeaderOptions: headerWithKeyReference as JwsProtectedHeaderOptions,
        })
        return {
          format: 'jwt',
          statusList: jws,
          parsed: Jwt.fromSerializedJwt(jws),
        } as Extract<TokenStatusListResult, { format: Format }>
      }
    } catch (e) {
      throw new CredoError(`Unable to authenticate or sign the token status list`, { cause: e })
    }

    // biome-ignore lint/suspicious/noExplicitAny: `options` is never due to only having two options, but it can ofcourse still happen
    throw new CredoError(`Could not create token status list with format '${(options as any).format}'`)
  }

  public async updateTokenStatusList<Format extends TokenStatusListFormat>(
    agentContext: AgentContext,
    options: UpdateTokenStatusListOptions
  ): Promise<Extract<TokenStatusListResult, { format: Format }>> {
    // TODO: jwk could also be supported
    if (options.signer.method !== 'x5c') {
      throw new Error(
        `signer method '${options.signer.method}' is not supported for creating a token status list. Only x5c is`
      )
    }

    const [{ keyId }] = options.signer.x5c

    const kms = agentContext.dependencyManager.resolve(KeyManagementApi)
    const jwk = await kms.getPublicKey({ keyId })

    const now = options.now ?? new Date()
    const issuedAt = options.issuedAt ?? now

    try {
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
        const updatedCwt = new StatusListCwt({
          payload: updatedPayload,
          protectedHeaders: new Map<number, unknown>([
            [RegisteredCwtHeaderClaimKey.X5Chain, options.signer.x5c.map((cert) => cert.rawCertificate)],
            [RegisteredCwtHeaderClaimKey.Algorithm, jwkToCoseKey.alg(options.alg)],
          ]),
        })

        const shouldAuthenticate = jwk.alg?.toUpperCase().startsWith('HS')
        if (shouldAuthenticate) {
          const mac0Context = getMac0Context(agentContext)
          return {
            format: 'cwt',
            statusList: await updatedCwt.authenticateAndEncode({ key: CoseKey.fromJwk(jwk) }, mac0Context),
            parsed: updatedCwt,
          } as Extract<TokenStatusListResult, { format: Format }>
        } else {
          const sign1Context = getSign1Context(agentContext)
          return {
            format: 'cwt',
            statusList: await updatedCwt.signAndEncode(
              { signingKey: CoseKey.fromJwk(jwk), algorithm: jwkToCoseKey.alg(options.alg) as SignatureAlgorithm },
              sign1Context
            ),
            parsed: updatedCwt,
          } as Extract<TokenStatusListResult, { format: Format }>
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

        const updatedPayload: Record<string, unknown> = {
          ...jwt.payload.toJson(),
          ...options.additionalPayload,
          iat: dateToSeconds(issuedAt),
        }
        if (options.expiresAt !== undefined) {
          updatedPayload.exp = dateToSeconds(options.expiresAt)
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
          keyId,
          protectedHeaderOptions: header as JwsProtectedHeaderOptions,
        })
        return {
          format: 'jwt',
          statusList: jws,
          parsed: Jwt.fromSerializedJwt(jws),
        } as Extract<TokenStatusListResult, { format: Format }>
      }
    } catch (e) {
      throw new CredoError(`Unable to update the token status list`, { cause: e })
    }

    throw new CredoError(`Invalid token format for token '${options.token}'. Only string and Uint8Array are supported`)
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
