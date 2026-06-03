import { Expose, instanceToPlain, Transform, TransformationType } from 'class-transformer'
import { IsOptional, ValidateNested } from 'class-validator'
import type { JsonObject, SingleOrArray } from '../../../../types'
import { JsonTransformer, mapSingleOrArray } from '../../../../utils'
import { IsInstanceOrArrayOfInstances, IsNever, IsUri } from '../../../../utils/validators'
import { CREDENTIALS_CONTEXT_V2_URL, VERIFIABLE_PRESENTATION_TYPE } from '../../constants'
import {
  W3cV2DataIntegrityVerifiableCredential,
  type W3cV2DataIntegrityVerifiableCredentialOptions,
} from '../../data-integrity-v1/W3cV2DataIntegrityVerifiableCredential'
import { IsCredentialJsonLdContext, IsVerifiablePresentationType } from '../../validators'
import {
  W3cV2EnvelopedVerifiableCredential,
  type W3cV2EnvelopedVerifiableCredentialOptions,
} from '../credential/W3cV2EnvelopedVerifiableCredential'
import {
  W3cV2EnvelopedVerifiablePresentation,
  type W3cV2EnvelopedVerifiablePresentationOptions,
} from './W3cV2EnvelopedVerifiablePresentation'
import { IsW3cV2Holder, W3cV2Holder, type W3cV2HolderOptions, W3cV2HolderTransformer } from './W3cV2Holder'
import type { W3cV2JsonPresentation } from './W3cV2JsonPresentation'

export type W3cV2PresentationCredentialEntry =
  | W3cV2EnvelopedVerifiableCredential
  | W3cV2EnvelopedVerifiablePresentation
  | W3cV2DataIntegrityVerifiableCredential

export type W3cV2PresentationCredentialEntryOptions =
  | W3cV2EnvelopedVerifiableCredentialOptions
  | W3cV2EnvelopedVerifiablePresentationOptions
  | W3cV2DataIntegrityVerifiableCredentialOptions['securedCredential']
  | W3cV2PresentationCredentialEntry

export interface W3cV2PresentationOptions {
  id?: string
  context?: Array<string | JsonObject>
  type?: SingleOrArray<string>
  verifiableCredential?: SingleOrArray<W3cV2PresentationCredentialEntryOptions>
  holder?: string | W3cV2HolderOptions
}

export class W3cV2Presentation {
  public constructor(options: W3cV2PresentationOptions) {
    if (options) {
      this.id = options.id
      this.context = options.context ?? [CREDENTIALS_CONTEXT_V2_URL]
      this.type = options.type ?? [VERIFIABLE_PRESENTATION_TYPE]
      if (options.verifiableCredential) {
        this.verifiableCredential = mapSingleOrArray(options.verifiableCredential, (entry) => {
          if (
            entry instanceof W3cV2EnvelopedVerifiableCredential ||
            entry instanceof W3cV2EnvelopedVerifiablePresentation ||
            entry instanceof W3cV2DataIntegrityVerifiableCredential
          ) {
            return entry
          }

          if (isEnvelopedVerifiablePresentationEntry(entry)) {
            return new W3cV2EnvelopedVerifiablePresentation(entry)
          }

          if (isEmbeddedDataIntegrityCredential(entry)) {
            return W3cV2DataIntegrityVerifiableCredential.fromObject(entry)
          }

          return new W3cV2EnvelopedVerifiableCredential(entry as W3cV2EnvelopedVerifiableCredentialOptions)
        })
      }

      if (options.holder) {
        this.holder = typeof options.holder === 'string' ? options.holder : new W3cV2Holder(options.holder)
      }
    }
  }

  @Expose({ name: '@context' })
  @IsCredentialJsonLdContext({ credentialContext: CREDENTIALS_CONTEXT_V2_URL })
  public context!: Array<string | JsonObject>

  @IsOptional()
  @IsUri()
  public id?: string

  @IsVerifiablePresentationType()
  public type!: SingleOrArray<string>

  @W3cV2HolderTransformer()
  @IsW3cV2Holder()
  @IsOptional()
  public holder?: string | W3cV2Holder

  @W3cV2PresentationCredentialEntryTransformer()
  @IsOptional()
  @IsInstanceOrArrayOfInstances({
    classType: [
      W3cV2EnvelopedVerifiableCredential,
      W3cV2EnvelopedVerifiablePresentation,
      W3cV2DataIntegrityVerifiableCredential,
    ],
  })
  @ValidateNested({ each: true })
  public verifiableCredential?: SingleOrArray<W3cV2PresentationCredentialEntry>

  @IsNever()
  public vc?: never

  @IsNever()
  public vp?: never

  public get holderId(): string | undefined {
    if (!this.holder) return undefined

    return this.holder instanceof W3cV2Holder ? this.holder.id : this.holder
  }

  public toJSON() {
    return JsonTransformer.toJSON(this) as W3cV2JsonPresentation
  }
}

function isEmbeddedDataIntegrityCredential(
  value: unknown
): value is W3cV2DataIntegrityVerifiableCredentialOptions['securedCredential'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  return 'proof' in value
}

function isEnvelopedVerifiablePresentationEntry(value: unknown): value is W3cV2EnvelopedVerifiablePresentationOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const type = (value as { type?: unknown }).type
  const values = Array.isArray(type) ? type : [type]

  return values.some((entry) => entry === 'EnvelopedVerifiablePresentation')
}

function jsonToCredentialEntry(value: unknown): W3cV2PresentationCredentialEntry {
  if (
    value instanceof W3cV2EnvelopedVerifiableCredential ||
    value instanceof W3cV2EnvelopedVerifiablePresentation ||
    value instanceof W3cV2DataIntegrityVerifiableCredential
  ) {
    return value
  }

  if (isEnvelopedVerifiablePresentationEntry(value)) {
    return JsonTransformer.fromJSON(value, W3cV2EnvelopedVerifiablePresentation)
  }

  if (isEmbeddedDataIntegrityCredential(value)) {
    return W3cV2DataIntegrityVerifiableCredential.fromObject(value)
  }

  return JsonTransformer.fromJSON(value, W3cV2EnvelopedVerifiableCredential)
}

function credentialEntryToJson(value: unknown) {
  if (value instanceof W3cV2DataIntegrityVerifiableCredential) {
    return value.securedCredential
  }

  return instanceToPlain(value)
}

export function W3cV2PresentationCredentialEntryTransformer() {
  return Transform(({ value, type }: { value: SingleOrArray<unknown>; type: TransformationType }) => {
    if (type === TransformationType.PLAIN_TO_CLASS) {
      return Array.isArray(value) ? value.map(jsonToCredentialEntry) : jsonToCredentialEntry(value)
    }

    if (type === TransformationType.CLASS_TO_PLAIN) {
      if (Array.isArray(value)) return value.map(credentialEntryToJson)
      return credentialEntryToJson(value)
    }

    // PLAIN_TO_PLAIN
    return value
  })
}
