import { IsStringOrStringArray } from '@credo-ts/core'
import { Transform, Type } from 'class-transformer'
import { IsArray, IsNumber, IsObject, IsOptional, IsString, Validate, ValidateNested } from 'class-validator'

export type WebVhResourceIdParts = {
  did: string
  resourceId: string
}

export class WebVhAttestedResourceProof {
  @IsString()
  public type!: string

  @IsString()
  public cryptosuite!: string

  @IsString()
  public proofPurpose!: string

  @IsString()
  public proofValue!: string

  @IsString()
  public verificationMethod!: string
}

export class WebVhAttestedResourceLink {
  @IsString()
  public id!: string

  @IsString()
  public type!: string

  @IsOptional()
  @IsNumber()
  public timestamp?: number

  @IsOptional()
  @IsString()
  public digestMultibase?: string
}

export class WebVhAttestedResource {
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  public '@context'!: string[]

  @Validate(IsStringOrStringArray)
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @Type(() => String)
  public type!: string[]

  @IsString()
  public id!: string

  @IsObject()
  public content!: unknown

  @ValidateNested()
  @Type(() => WebVhAttestedResourceProof)
  public proof!: WebVhAttestedResourceProof

  @IsOptional()
  @IsObject()
  public metadata?: Record<string, unknown>

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WebVhAttestedResourceLink)
  public links?: WebVhAttestedResourceLink[]
}

export interface WebVhResourcePublisher<TResource = unknown, TOptions = unknown> {
  publish(options: TOptions): Promise<TResource>
}

export interface WebVhResourceResolver<TResource = unknown> {
  resolve(resourceId: string): Promise<TResource>
}

export function isWebVhAttestedResource(value: unknown): value is WebVhAttestedResource {
  if (!value || typeof value !== 'object') return false

  const candidate = value as {
    type?: unknown
    id?: unknown
    content?: unknown
    proof?: unknown
    metadata?: unknown
    links?: unknown
  }

  if (!Array.isArray(candidate.type) || !candidate.type.includes('AttestedResource')) return false
  if (typeof candidate.id !== 'string') return false
  if (!candidate.content || typeof candidate.content !== 'object') return false
  if (!candidate.proof || typeof candidate.proof !== 'object') return false
  if (candidate.metadata !== undefined && typeof candidate.metadata !== 'object') return false
  if (candidate.links !== undefined && !Array.isArray(candidate.links)) return false

  return true
}

export function parseResourceId(resourceId: string): WebVhResourceIdParts | null {
  const match = resourceId.match(/^(did:webvh:[^/]+)\/resources\/([^/]+)$/)
  if (!match) return null

  return {
    did: match[1],
    resourceId: match[2],
  }
}

export function getResourceType(resource: Pick<WebVhAttestedResource, 'metadata'>): string | undefined {
  const resourceType = resource.metadata?.resourceType
  return typeof resourceType === 'string' ? resourceType : undefined
}
