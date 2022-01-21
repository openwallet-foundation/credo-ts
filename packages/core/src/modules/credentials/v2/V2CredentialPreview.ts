import type { CredentialPreviewOptions } from '../CredentialPreviewAttributes'

import { Expose, Type } from 'class-transformer'
import { Equals, IsInstance, ValidateNested } from 'class-validator'

import { JsonTransformer } from '../../../utils/JsonTransformer'
import { CredentialPreviewAttribute } from '../CredentialPreviewAttributes'

/**
 * Credential preview inner message class.
 *
 * This is not a message but an inner object for other messages in this protocol. It is used construct a preview of the data for the credential.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0036-issue-credential/README.md#preview-credential
 */
export class V2CredentialPreview {
  public constructor(options: CredentialPreviewOptions) {
    if (options) {
      this.attributes = options.attributes
    }
  }

  @Expose({ name: '@type' })
  @Equals(V2CredentialPreview.type)
  public type = V2CredentialPreview.type
  public static type = 'https://didcomm.org/issue-credential/2.0/credential-preview'

  @Type(() => CredentialPreviewAttribute)
  @ValidateNested({ each: true })
  @IsInstance(CredentialPreviewAttribute, { each: true })
  public attributes!: CredentialPreviewAttribute[]

  public toJSON(): Record<string, unknown> {
    return JsonTransformer.toJSON(this)
  }

  /**
   * Create a credential preview from a record with name and value entries.
   *
   * @example
   * const preview = CredentialPreview.fromRecord({
   *   name: "Bob",
   *   age: "20"
   * })
   */
  public static fromRecord(record: Record<string, string>) {
    const attributes = Object.entries(record).map(
      ([name, value]) =>
        new CredentialPreviewAttribute({
          name,
          mimeType: 'text/plain',
          value,
        })
    )

    return new V2CredentialPreview({
      attributes,
    })
  }
}
