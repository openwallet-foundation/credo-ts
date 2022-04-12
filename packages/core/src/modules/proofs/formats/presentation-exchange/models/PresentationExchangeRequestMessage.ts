import type { InputDescriptors } from './InputDescriptors'

import { Expose } from 'class-transformer'

export interface ProofOptions {
  challenge: string
  domain: string
}

export interface PresentationExchangeRequestMessageOptions {
  options: ProofOptions
  presentationDefinition: InputDescriptors[]
}

export class PresentationExchangeRequestMessage {
  public constructor(options: PresentationExchangeRequestMessageOptions) {
    if (options) {
      this.options = options.options
      this.presentationDefinition = options.presentationDefinition
    }
  }

  public options!: ProofOptions

  @Expose({ name: 'presentation_definition' })
  public presentationDefinition!: InputDescriptors[]
}
