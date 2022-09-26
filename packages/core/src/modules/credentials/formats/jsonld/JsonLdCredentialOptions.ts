import { Expose, Type } from 'class-transformer'

import { W3cCredential } from '../../../vc/models/credential/W3cCredential'

import { JsonLdOptionsRFC0593 } from './JsonLdOptionsRFC0593'

export interface JsonLdCredentialOptions {
  credential: W3cCredential
  options: JsonLdOptionsRFC0593
}

/**
 * Class providing validation for the V2 json ld credential as per RFC0593 (used to sign credentials)
 *
 */
export class JsonLdCredential {
  public constructor(options: JsonLdCredentialOptions) {
    if (options) {
      this.credential = options.credential
      this.options = options.options
    }
  }

  @Type(() => W3cCredential)
  public credential!: W3cCredential

  @Expose({ name: 'options' })
  @Type(() => JsonLdOptionsRFC0593)
  public options!: JsonLdOptionsRFC0593
}
