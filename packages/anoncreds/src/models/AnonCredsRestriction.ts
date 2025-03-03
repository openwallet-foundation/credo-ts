import { Exclude, Expose, Transform, TransformationType } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'

export interface AnonCredsRestrictionOptions {
  schemaId?: string
  schemaIssuerDid?: string
  schemaIssuerId?: string
  schemaName?: string
  schemaVersion?: string
  issuerDid?: string
  issuerId?: string
  credentialDefinitionId?: string
  attributeMarkers?: Record<string, true>
  attributeValues?: Record<string, string>
}

export class AnonCredsRestriction {
  public constructor(options: AnonCredsRestrictionOptions) {
    if (options) {
      this.schemaId = options.schemaId
      this.schemaIssuerDid = options.schemaIssuerDid
      this.schemaIssuerId = options.schemaIssuerId
      this.schemaName = options.schemaName
      this.schemaVersion = options.schemaVersion
      this.issuerDid = options.issuerDid
      this.issuerId = options.issuerId
      this.credentialDefinitionId = options.credentialDefinitionId
      this.attributeMarkers = options.attributeMarkers ?? {}
      this.attributeValues = options.attributeValues ?? {}
    }
  }

  @Expose({ name: 'schema_id' })
  @IsOptional()
  @IsString()
  public schemaId?: string

  @Expose({ name: 'schema_issuer_did' })
  @IsOptional()
  @IsString()
  public schemaIssuerDid?: string

  @Expose({ name: 'schema_issuer_id' })
  @IsOptional()
  @IsString()
  public schemaIssuerId?: string

  @Expose({ name: 'schema_name' })
  @IsOptional()
  @IsString()
  public schemaName?: string

  @Expose({ name: 'schema_version' })
  @IsOptional()
  @IsString()
  public schemaVersion?: string

  @Expose({ name: 'issuer_did' })
  @IsOptional()
  @IsString()
  public issuerDid?: string

  @Expose({ name: 'issuer_id' })
  @IsOptional()
  @IsString()
  public issuerId?: string

  @Expose({ name: 'cred_def_id' })
  @IsOptional()
  @IsString()
  public credentialDefinitionId?: string

  @Exclude()
  public attributeMarkers: Record<string, boolean> = {}

  @Exclude()
  public attributeValues: Record<string, string> = {}
}

/**
 * Decorator that transforms attribute values and attribute markers.
 *
 * It will transform between the following JSON structure:
 * ```json
 * {
 *  "attr::test_prop::value": "test_value"
 *  "attr::test_prop::marker": "1
 * }
 * ```
 *
 * And the following AnonCredsRestriction:
 * ```json
 * {
 *  "attributeValues": {
 *    "test_prop": "test_value"
 *  },
 *  "attributeMarkers": {
 *   "test_prop": true
 *  }
 * }
 * ```
 *
 * @example
 * class Example {
 *   AttributeFilterTransformer()
 *   public restrictions!: AnonCredsRestriction[]
 * }
 */
export function AnonCredsRestrictionTransformer() {
  return Transform(({ value: restrictions, type }) => {
    switch (type) {
      case TransformationType.CLASS_TO_PLAIN:
        if (restrictions && Array.isArray(restrictions)) {
          for (const restriction of restrictions) {
            const r = restriction as AnonCredsRestriction

            for (const [attributeName, attributeValue] of Object.entries(r.attributeValues)) {
              restriction[`attr::${attributeName}::value`] = attributeValue
            }

            for (const [attributeName] of Object.entries(r.attributeMarkers)) {
              restriction[`attr::${attributeName}::marker`] = '1'
            }
          }
        }

        return restrictions

      case TransformationType.PLAIN_TO_CLASS:
        if (restrictions && Array.isArray(restrictions)) {
          for (const restriction of restrictions) {
            const r = restriction as AnonCredsRestriction

            for (const [attributeName, attributeValue] of Object.entries(r)) {
              const match = /^attr::([^:]+)::(value|marker)$/.exec(attributeName)

              if (match && match[2] === 'marker' && attributeValue === '1') {
                r.attributeMarkers[match[1]] = true
                delete restriction[attributeName]
              } else if (match && match[2] === 'value') {
                r.attributeValues[match[1]] = attributeValue
                delete restriction[attributeName]
              }
            }
          }
        }
        return restrictions
      default:
        return restrictions
    }
  })
}
