import type { InputDescriptors } from './InputDescriptors'

import { Expose } from 'class-transformer'
import { IsOptional, IsString, ValidateNested } from 'class-validator'

import { JsonTransformer } from '../../../../../utils'

interface ProofTypeOptions {
  proofType: string[]
}

export class ProofType {
  public constructor(options: ProofTypeOptions) {
    if (options) {
      this.proofType = options.proofType
    }
  }
  @Expose({ name: 'proof_type' })
  public proofType!: string[]
}

// export class LdpVc {
//   public constructor(ldpVc: ProofType) {
//     if (ldpVc) {
//       this.ldpVc = ldpVc
//     }
//   }

//   @Expose({ name: 'ldp_vc' })
//   public ldpVc!: ProofType
// }
// export class LdpVp {
//   public constructor(ldpVp: ProofType) {
//     if (ldpVp) {
//       this.ldpVp = ldpVp
//     }
//   }

//   @Expose({ name: 'ldp_vp' })
//   public ldpVp!: ProofType

//   public toJSON() {
//     return JsonTransformer.toJSON(this)
//   }
// }

export interface ClaimFormatSchemaOptions {
  ldpVp?: ProofType
  ldpVc?: ProofType
}

export class ClaimFormatSchema {
  public constructor(options: ClaimFormatSchemaOptions) {
    if (options) {
      this.ldpVp = options.ldpVp
      this.ldpVc = options.ldpVc
    }
  }

  @Expose({ name: 'ldp_vp' })
  @IsOptional()
  public ldpVp?: ProofType

  @Expose({ name: 'ldp_vc' })
  @IsOptional()
  public ldpVc?: ProofType
}

export interface PresentationDefinitionOptions {
  inputDescriptors: InputDescriptors[]
  format: ClaimFormatSchema
}

export class PresentationDefinition {
  public constructor(options: PresentationDefinitionOptions) {
    if (options) {
      this.inputDescriptors = options.inputDescriptors
      this.format = options.format
    }
  }

  @Expose({ name: 'input_descriptors' })
  @ValidateNested({ each: true })
  public inputDescriptors!: InputDescriptors[]

  @IsString()
  public format!: ClaimFormatSchema

  public toJSON() {
    return JsonTransformer.toJSON(this)
  }
}

export interface PresentationOptions {
  challenge: string
  domain: string
}

export interface RequestPresentationOptions {
  options: PresentationOptions
  presentationDefinition: PresentationDefinition
}

export class RequestPresentation {
  public constructor(options: RequestPresentationOptions) {
    if (options) {
      this.options = options.options
      this.presentationDefinition = options.presentationDefinition
    }
  }

  @Expose({ name: 'presentation_definition' })
  @ValidateNested({ each: true })
  public presentationDefinition!: PresentationDefinition

  @IsString()
  public options!: PresentationOptions

  public toJSON() {
    return JsonTransformer.toJSON(this)
  }
}
