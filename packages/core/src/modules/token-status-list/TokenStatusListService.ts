import { CoseKey, jwkToCoseKey, RegisteredCwtHeaderClaimKey, SignatureAlgorithm } from '@owf/cose'
import {
  createHeaderAndPayload,
  fetchStatusList,
  getListFromStatusListJWT,
  StatusList,
  StatusListCwt,
} from '@owf/token-status-list'
import type { AgentContext } from '../../agent'
import { type JwsProtectedHeaderOptions, JwsService, Jwt, JwtPayload } from '../../crypto'
import { getMac0Context } from '../../crypto/contexts/mac0Context'
import { getSign1Context } from '../../crypto/contexts/sign1Context'
import { CredoError } from '../../error'
import { injectable } from '../../plugins'
import { KeyManagementApi } from '../kms'
import type {
  CreateTokenStatusListOptions,
  FetchTokenStatusListOptions,
  TokenStatusListFormat,
  TokenStatusListResult,
  TokenStatusListResultFor,
  UpdateTokenStatusListOptions,
} from './TokenStatusListOptions'

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
    if (options.signer.method !== 'x5c') {
      throw new Error('Only an x5c signer is allowed for signing a token status list.')
    }
    const [signingCertificate] = options.signer.x5c

    const statusList = new StatusList(
      new Array(options.statusListLength).fill(0),
      options.bitsPerStatus,
      options.aggregationUri
    )
    const kms = agentContext.dependencyManager.resolve(KeyManagementApi)
    const jwk = await kms.getPublicKey({ keyId: signingCertificate.keyId })
    if (!options.algorithm && !jwk.alg) {
      throw new CredoError(
        `Found JWK for key id '${signingCertificate.keyId}' on signingCertificate, but did not find a required algorithm or provided algorithm in options`
      )
    }
    if (options.format === 'cwt') {
      const cwt = new StatusListCwt({
        payload: { statusList, subject: options.statusListUri, ...options.claims },
        protectedHeaders: new Map<number, unknown>([
          [RegisteredCwtHeaderClaimKey.X5Chain, options.signer.x5c.map((cert) => cert.rawCertificate)],
          [RegisteredCwtHeaderClaimKey.Algorithm, jwkToCoseKey.alg(options.algorithm ?? jwk.alg)],
        ]),
      })
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
          statusList: await cwt.signAndEncode(
            {
              signingKey: CoseKey.fromJwk(jwk),
              algorithm: jwkToCoseKey.alg(options.algorithm ?? jwk.alg) as SignatureAlgorithm,
            },
            sign1Context
          ),
          parsed: cwt,
        } as Extract<TokenStatusListResult, { format: Format }>
      }
    }

    if (options.format === 'jwt') {
      const { header, payload } = createHeaderAndPayload(
        statusList,
        { cnf: { jwk } },
        { alg: (options.algorithm as string) ?? jwk.alg, typ: 'statuslist+jwt' }
      )
      const jwsService = agentContext.dependencyManager.resolve(JwsService)
      const jws = await jwsService.createJwsCompact(agentContext, {
        payload: new JwtPayload({ additionalClaims: payload }),
        keyId: signingCertificate.keyId,
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

  /**
   * @todo what do we allow to update and what don't we? Do we need to see if the same x5c is used?
   */
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
    if (options.signer.method !== 'x5c') {
      throw new Error('Only an x5c signer is allowed for signing a token status list.')
    }
    const [signingCertificate] = options.signer.x5c

    const kms = agentContext.dependencyManager.resolve(KeyManagementApi)
    const jwk = await kms.getPublicKey({ keyId: signingCertificate.keyId })
    if (!options.algorithm && !jwk.alg) {
      throw new CredoError(
        `Found JWK for key id '${signingCertificate.keyId}' in certificate, but did not find a required algorithm in the key or supplied in the options`
      )
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

        return {
          statusList: await cwt.signAndEncode(
            {
              signingKey: CoseKey.fromJwk(jwk),
              algorithm: jwkToCoseKey.alg(options.algorithm ?? jwk.alg) as SignatureAlgorithm,
            },
            sign1Context
          ),
          parsed: cwt,
        }
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
        keyId: signingCertificate.keyId,
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
