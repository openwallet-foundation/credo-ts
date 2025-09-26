import type { CredentialPreviewOptions } from '../../../models/DidCommCredentialPreviewAttribute'

import { JsonTransformer } from '@credo-ts/core'
import { Expose, Transform, Type } from 'class-transformer'
import { IsInstance, ValidateNested } from 'class-validator'

import { IsValidMessageType, parseMessageType, replaceLegacyDidSovPrefix } from '../../../../../util/messageType'
import { DidCommCredentialPreviewAttribute } from '../../../models/DidCommCredentialPreviewAttribute'

/**
 * Credential preview inner message class.
 *
 * This is not a message but an inner object for other messages in this protocol. It is used construct a preview of the data for the credential.
 *
 * @see https://github.com/hyperledger/aries-rfcs/tree/main/features/0453-issue-credential-v2#preview-credential
 */
export class DidCommCredentialV2Preview {
  public constructor(options: CredentialPreviewOptions) {
    if (options) {
      this.attributes = options.attributes.map((a) => new DidCommCredentialPreviewAttribute(a))
    }
  }

  @Expose({ name: '@type' })
  @IsValidMessageType(DidCommCredentialV2Preview.type)
  @Transform(({ value }) => replaceLegacyDidSovPrefix(value), {
    toClassOnly: true,
  })
  public readonly type = DidCommCredentialV2Preview.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/2.0/credential-preview')

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

    return new DidCommCredentialV2Preview({
      attributes,
    })
  }
}
