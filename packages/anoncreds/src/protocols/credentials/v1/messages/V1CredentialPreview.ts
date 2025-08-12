import type { CredentialPreviewOptions } from '@credo-ts/didcomm'

import { JsonTransformer } from '@credo-ts/core'
import {
  DidCommCredentialPreviewAttribute,
  IsValidMessageType,
  parseMessageType,
  replaceLegacyDidSovPrefix,
} from '@credo-ts/didcomm'
import { Expose, Transform, Type } from 'class-transformer'
import { IsInstance, ValidateNested } from 'class-validator'

/**
 * Credential preview inner message class.
 *
 * This is not a message but an inner object for other messages in this protocol. It is used construct a preview of the data for the credential.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0036-issue-credential/README.md#preview-credential
 */
export class V1CredentialPreview {
  public constructor(options: CredentialPreviewOptions) {
    if (options) {
      this.attributes = options.attributes.map((a) => new DidCommCredentialPreviewAttribute(a))
    }
  }

  @Expose({ name: '@type' })
  @IsValidMessageType(V1CredentialPreview.type)
  @Transform(({ value }) => replaceLegacyDidSovPrefix(value), {
    toClassOnly: true,
  })
  public readonly type = V1CredentialPreview.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/1.0/credential-preview')

  @Type(() => DidCommCredentialPreviewAttribute)
  @ValidateNested({ each: true })
  @IsInstance(DidCommCredentialPreviewAttribute, { each: true })
  public attributes!: DidCommCredentialPreviewAttribute[]

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
        new DidCommCredentialPreviewAttribute({
          name,
          mimeType: 'text/plain',
          value,
        })
    )

    return new V1CredentialPreview({
      attributes,
    })
  }
}
