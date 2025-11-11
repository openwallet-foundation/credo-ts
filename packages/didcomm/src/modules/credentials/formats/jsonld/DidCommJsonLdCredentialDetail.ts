import { W3cCredential } from '@credo-ts/core'
import { Expose, Type } from 'class-transformer'

import { DidCommJsonLdCredentialDetailOptions } from './DidCommJsonLdCredentialDetailOptions'

export interface DidCommJsonLdCredentialDetailInputOptions {
  credential: W3cCredential
  options: DidCommJsonLdCredentialDetailOptions
}

/**
 * Class providing validation for the V2 json ld credential as per RFC0593 (used to sign credentials)
 *
 */
export class DidCommJsonLdCredentialDetail {
  public constructor(options: DidCommJsonLdCredentialDetailInputOptions) {
    if (options) {
      this.credential = options.credential
      this.options = options.options
    }
  }

  @Type(() => W3cCredential)
  public credential!: W3cCredential

  @Expose({ name: 'options' })
  @Type(() => DidCommJsonLdCredentialDetailOptions)
  public options!: DidCommJsonLdCredentialDetailOptions
}
