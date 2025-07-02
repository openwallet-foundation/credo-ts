import { StatusList, getListFromStatusListJWT } from '@sd-jwt/jwt-status-list'
import { isURL } from 'class-validator'
import { injectable } from 'tsyringe'
import { CredoError } from '../../../../error'
import { fetchWithTimeout } from './../../../../utils/fetch'
import { AgentContext } from '../../../../agent'
import { JwsService, Jwt, JwtPayload } from '../../../../crypto'
import { parseDid } from '../../../dids'
import { SdJwtVcIssuer } from '../../SdJwtVcOptions'
import { SdJwtVcService } from '../../SdJwtVcService'
import { TokenStatusListError } from './TokenStatusListError'

export interface CreateTokenStatusListOptions {
  issuer: SdJwtVcIssuer
  name: string
  tag: string
  size: number
  publish: boolean
}

export interface CreateTokenStatusListResult {
  jwt: string
  uri?: string
}

export interface RevokeIndicesOptions {
  issuer: SdJwtVcIssuer
  publish: boolean
  indices: number[]
}

/**
 * @internal
 */
@injectable()
export class TokenStatusListService {
  public static type = 'TokenStatusList'

  async createStatusList(
    agentContext: AgentContext,
    options: CreateTokenStatusListOptions
  ): Promise<CreateTokenStatusListResult> {
    const sdJwtService = agentContext.dependencyManager.resolve(SdJwtVcService)
    const jwsService = agentContext.dependencyManager.resolve(JwsService)

    const statusList = new StatusList(new Array(options.size).fill(0), 1)

    const issuer = await sdJwtService.extractKeyFromIssuer(agentContext, options.issuer, true)

    // construct jwt payload
    const jwtPayload = new JwtPayload({
      iss: issuer.iss,
      iat: Math.floor(Date.now() / 1000),
      additionalClaims: {
        status_list: {
          bits: statusList.getBitsPerStatus(),
          lst: statusList.compressStatusList(),
        },
      },
    })

    // sign JWT
    const jwt = await jwsService.createJwsCompact(agentContext, {
      payload: jwtPayload,
      keyId: issuer.publicJwk.keyId,
      protectedHeaderOptions: {
        alg: issuer.alg,
        typ: 'statuslist+jwt',
      },
    })

    if (options.publish) {
      // extended by different registries
      const uri = await this.publishStatusList(agentContext, jwt)
      return { jwt, uri }
    }

    return { jwt }
  }

  async revokeIndex(agentContext: AgentContext, statusListId: string, options: RevokeIndicesOptions): Promise<boolean> {
    const sdJwtService = agentContext.dependencyManager.resolve(SdJwtVcService)
    const jwsService = agentContext.dependencyManager.resolve(JwsService)

    const currentStatusListJwt = await this.getStatusList(agentContext, statusListId)
    const parsedStatusListJwt = Jwt.fromSerializedJwt(currentStatusListJwt)

    // extract and validate iss
    const iss = parsedStatusListJwt.payload.iss as string
    if (options.issuer.method === 'did' && parseDid(options.issuer.didUrl).did !== iss) {
      throw new TokenStatusListError('Invalid issuer')
    }
    if (options.issuer.method === 'x5c' && options.issuer.issuer !== iss) {
      throw new TokenStatusListError('Invalid issuer')
    }

    const header = parsedStatusListJwt.header

    const statusList = getListFromStatusListJWT(currentStatusListJwt)
    // update indices
    for (const revokedIndex of options.indices) {
      statusList.setStatus(revokedIndex, 1)
    }

    const issuer = await sdJwtService.extractKeyFromIssuer(agentContext, options.issuer, true)

    // construct jwt payload
    const jwtPayload = new JwtPayload({
      iss,
      iat: Math.floor(Date.now() / 1000),
      additionalClaims: {
        status_list: {
          bits: statusList.getBitsPerStatus(),
          lst: statusList.compressStatusList(),
        },
      },
    })

    const jwt = await jwsService.createJwsCompact(agentContext, {
      payload: jwtPayload,
      keyId: issuer.publicJwk.keyId,
      protectedHeaderOptions: {
        alg: issuer.alg,
        typ: header.typ,
      },
    })

    if (options.publish) {
      await this.publishStatusList(agentContext, jwt)
    }

    return true
  }

  async getStatus(agentContext: AgentContext, statusListId: string, index: number): Promise<number> {
    const currentStatusListJwt = await this.getStatusList(agentContext, statusListId)
    const statusList = getListFromStatusListJWT(currentStatusListJwt)
    return statusList.getStatus(index)
  }

  async getStatusList(agentContext: AgentContext, statusListId: string): Promise<string> {
    const jwsService = agentContext.dependencyManager.resolve(JwsService)

    let jwt: string
    if (isURL(statusListId)) {
      jwt = await this.getStatusListFetcher(agentContext)(statusListId)
    } else {
      throw new Error('Not supported')
    }

    const verified = await jwsService.verifyJws(agentContext, { jws: jwt })

    // verify jwt
    if (!verified.isValid) {
      throw new TokenStatusListError('Invalid Jwt in the provided statusListId')
    }
    return jwt
  }

  private getStatusListFetcher(agentContext: AgentContext) {
    return async (uri: string) => {
      const response = await fetchWithTimeout(agentContext.config.agentDependencies.fetch, uri, {
        headers: {
          Accept: 'application/statuslist+jwt',
        },
      })

      if (!response.ok) {
        throw new CredoError(
          `Received invalid response with status ${
            response.status
          } when fetching status list from ${uri}. ${await response.text()}`
        )
      }

      return await response.text()
    }
  }

  async publishStatusList(_agentContext: AgentContext, _jwt: string): Promise<string> {
    throw new Error('Not implemented')
  }
}
