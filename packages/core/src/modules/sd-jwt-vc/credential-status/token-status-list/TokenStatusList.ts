import { StatusList, getListFromStatusListJWT } from '@sd-jwt/jwt-status-list'
import { isURL } from 'class-validator'
import { injectable } from 'tsyringe'
import { AgentContext } from '../../../../agent'
import { JwsService, Jwt, JwtPayload } from '../../../../crypto'
import { CredoError } from '../../../../error'
import { isDid } from '../../../../utils'
import { DidsApi, getPublicJwkFromVerificationMethod, parseDid } from '../../../dids'
import { SdJwtVcModuleConfig } from '../../SdJwtVcModuleConfig'
import { SdJwtVcIssuer } from '../../SdJwtVcOptions'
import { SdJwtVcService } from '../../SdJwtVcService'
import { TokenStatusListError } from './TokenStatusListError'
import {
  PublishTokenStatusListOptions,
  TokenStatusListJwtPayload,
  TokenStatusListRegistry,
} from './TokenStatusListRegistry'

export interface CreateTokenStatusListOptions extends PublishTokenStatusListOptions {
  size: number
  publish: boolean
  bitsPerStatus?: number
}

export interface CreateTokenStatusListResult {
  jwt: string
  uri?: string
}

export interface RevokeIndicesOptions extends PublishTokenStatusListOptions {
  uri: string
  indices: number[]
  publish: boolean
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
    issuer: SdJwtVcIssuer,
    options: CreateTokenStatusListOptions
  ): Promise<CreateTokenStatusListResult> {
    const sdJwtService = agentContext.dependencyManager.resolve(SdJwtVcService)
    const jwsService = agentContext.dependencyManager.resolve(JwsService)

    const statusList = new StatusList(new Array(options.size).fill(0), 1)

    const issuerKey = await sdJwtService.extractKeyFromIssuer(agentContext, issuer, true)

    // construct jwt payload
    const jwtPayload = new JwtPayload({
      iss: issuerKey.iss,
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
      keyId: issuerKey.publicJwk.keyId,
      protectedHeaderOptions: {
        alg: issuerKey.alg,
        typ: 'statuslist+jwt',
        kid: issuerKey.kid,
      },
    })

    if (options.publish) {
      const result = await this.publishStatusList(agentContext, issuer, jwt, options)
      return { jwt, uri: result }
    }

    return { jwt }
  }

  async revokeIndex(
    agentContext: AgentContext,
    issuer: SdJwtVcIssuer,
    options: RevokeIndicesOptions
  ): Promise<boolean> {
    const sdJwtService = agentContext.dependencyManager.resolve(SdJwtVcService)
    const jwsService = agentContext.dependencyManager.resolve(JwsService)

    const { indices, publish, ...publishOptions } = options

    const currentStatusListJwt = await this.getStatusList(agentContext, options.uri)
    const parsedStatusListJwt = Jwt.fromSerializedJwt(currentStatusListJwt)

    // extract and validate iss
    const iss = parsedStatusListJwt.payload.iss as string
    if (issuer.method === 'did' && parseDid(issuer.didUrl).did !== iss) {
      throw new TokenStatusListError('Invalid issuer')
    }
    if (issuer.method === 'x5c' && issuer.issuer !== iss) {
      throw new TokenStatusListError('Invalid issuer')
    }

    const header = parsedStatusListJwt.header

    const statusList = getListFromStatusListJWT(currentStatusListJwt)
    // update indices
    for (const revokedIndex of options.indices) {
      statusList.setStatus(revokedIndex, 1)
    }

    const issuerKey = await sdJwtService.extractKeyFromIssuer(agentContext, issuer, true)

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
    } satisfies TokenStatusListJwtPayload)

    const jwt = await jwsService.createJwsCompact(agentContext, {
      payload: jwtPayload,
      keyId: issuerKey.publicJwk.keyId,
      protectedHeaderOptions: {
        alg: issuerKey.alg,
        typ: header.typ,
        kid: issuerKey.kid,
      },
    })

    if (options.publish) {
      await this.publishStatusList(agentContext, issuer, jwt, publishOptions)
    }

    return true
  }

  async getStatus(agentContext: AgentContext, uri: string, index: number): Promise<number> {
    const currentStatusListJwt = await this.getStatusList(agentContext, uri)
    const statusList = getListFromStatusListJWT(currentStatusListJwt)
    return statusList.getStatus(index)
  }

  async getStatusList(agentContext: AgentContext, uri: string): Promise<string> {
    const registry = this.findRegistry({ uri })
    if (!registry) {
      throw new TokenStatusListError(`No token status list registry registered for uri ${uri}`)
    }

    return await registry.retrieve(agentContext, uri)
  }

  getStatusListFetcher(agentContext: AgentContext) {
    return async (uri: string) => {
      return await this.getStatusList(agentContext, uri)
    }
  }

  async publishStatusList(
    agentContext: AgentContext,
    issuer: SdJwtVcIssuer,
    jwt: string,
    options: PublishTokenStatusListOptions
  ): Promise<string> {
    // verify jwt
    const verified = await this.verifyStatusList(agentContext, issuer, jwt)
    if (!verified.isValid) {
      throw new TokenStatusListError('Invalid Jwt in the provided statusListUri')
    }

    const registry = this.findRegistry({ uri: options.uri, issuer })
    if (!registry) {
      throw new TokenStatusListError(`No token status list registry registered for issuer ${issuer}`)
    }
    return await registry.publish(agentContext, issuer, jwt, options)
  }

  private findRegistry({ uri, issuer }: { uri?: string; issuer?: SdJwtVcIssuer }): TokenStatusListRegistry | null {
    let method: string

    if (uri) {
      if (isDid(uri)) {
        method = parseDid(uri).method
      } else if (isURL(uri)) {
        method = 'http'
      } else {
        throw new TokenStatusListError('Status List Uri is not supported')
      }
    } else if (issuer && issuer.method === 'did') {
      method = parseDid(issuer.didUrl).method
    } else {
      throw new TokenStatusListError('Status List Uri is not provided')
    }

    return this.sdJwtVcModuleConfig.registries.find((r) => r.supportedMethods.includes(method)) ?? null
  }

  private async verifyStatusList(agentContext: AgentContext, issuer: SdJwtVcIssuer, jwt: string) {
    const jwsService = agentContext.dependencyManager.resolve(JwsService)
    return await jwsService.verifyJws(agentContext, {
      jws: jwt,
      resolveJwsSigner:
        issuer.method === 'did'
          ? async ({ protectedHeader: { alg, kid } }) => {
              if (!kid || typeof kid !== 'string') throw new CredoError('Missing kid in protected header.')

              const { did } = parseDid(issuer.didUrl)
              const didUrl = `${did}${kid}`
              const didsApi = agentContext.dependencyManager.resolve(DidsApi)
              const didDocument = await didsApi.resolveDidDocument(did)
              const verificationMethod = didDocument.dereferenceKey(didUrl)
              const publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)

              return {
                alg,
                method: issuer.method,
                didUrl,
                jwk: publicJwk,
              }
            }
          : undefined,
    })
  }
}
