import { utils } from '@credo-ts/core'
import { StatusList, getListFromStatusListJWT } from '@sd-jwt/jwt-status-list'
import { isDid } from 'packages/core/src/utils'
import { injectable } from 'tsyringe'
import { AgentContext } from '../../../../agent'
import { JwsService, Jwt, JwtPayload } from '../../../../crypto'
import { parseDid } from '../../../dids'
import { SdJwtVcModuleConfig } from '../../SdJwtVcModuleConfig'
import { SdJwtVcIssuer } from '../../SdJwtVcOptions'
import { SdJwtVcService } from '../../SdJwtVcService'
import { TokenStatusListError } from './TokenStatusListError'
import { PublishTokenStatusListOptions, TokenStatusListRegistry } from './TokenStatusListRegistry'

export interface CreateTokenStatusListOptions {
  statusListId: string
  issuer: SdJwtVcIssuer
  name: string
  tag: string
  size: number
  publish: boolean
  publishTokenStatusListOptions?: PublishTokenStatusListOptions
}

export interface CreateTokenStatusListResult {
  jwt: string
  uri?: string
}

export interface RevokeIndicesOptions {
  issuer: SdJwtVcIssuer
  publish: boolean
  publishTokenStatusListOptions?: PublishTokenStatusListOptions
  indices: number[]
}

/**
 * @internal
 */
@injectable()
export class TokenStatusListService {
  private sdJwtVcModuleConfig: SdJwtVcModuleConfig

  public constructor(sdJwtVcModuleConfig: SdJwtVcModuleConfig) {
    this.sdJwtVcModuleConfig = sdJwtVcModuleConfig
  }

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

    const statusListId = options.statusListId

    if (options.publish && options.publishTokenStatusListOptions) {
      // extended by different registries
      const uri = await this.publishStatusList(agentContext, statusListId, jwt, options.publishTokenStatusListOptions)
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

    if (options.publish && options.publishTokenStatusListOptions) {
      await this.publishStatusList(agentContext, statusListId, jwt, options.publishTokenStatusListOptions)
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

    const registry = this.findRegistry(statusListId)
    if (!registry) {
      throw new TokenStatusListError(`No token status list registry registered for statusListId ${statusListId}`)
    }

    const jwt = await registry.retrieve(agentContext, statusListId)

    // verify jwt
    const verified = await jwsService.verifyJws(agentContext, { jws: jwt })
    if (!verified.isValid) {
      throw new TokenStatusListError('Invalid Jwt in the provided statusListId')
    }

    return jwt
  }

  async publishStatusList(
    agentContext: AgentContext,
    statusListId: string,
    jwt: string,
    options: PublishTokenStatusListOptions
  ): Promise<string> {
    const jwsService = agentContext.dependencyManager.resolve(JwsService)
    // verify jwt
    const verified = await jwsService.verifyJws(agentContext, { jws: jwt })
    if (!verified.isValid) {
      throw new TokenStatusListError('Invalid Jwt in the provided statusListId')
    }

    const registry = this.findRegistry(statusListId)
    if (!registry) {
      throw new TokenStatusListError(`No token status list registry registered for statusListId ${statusListId}`)
    }
    return await registry.publish(agentContext, statusListId, jwt, options)
  }

  private findRegistry(statusListId: string): TokenStatusListRegistry | null {
    let method: string
    if (isDid(statusListId)) {
      method = parseDid(statusListId).method
    } else {
      method = 'http' // TODO: implement default handler
    }

    return this.sdJwtVcModuleConfig.registries.find((r) => r.supportedMethods.includes(method)) ?? null
  }
}
