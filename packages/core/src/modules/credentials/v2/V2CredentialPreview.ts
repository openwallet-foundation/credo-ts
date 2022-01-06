import { Expose, Transform, Type } from 'class-transformer'
import { Equals } from 'class-validator'
import { replaceLegacyDidSovPrefix } from '../../../utils/messageType'
import { CredentialPreviewOptions, V1CredentialPreview } from '../v1/V1CredentialPreview'


/**
 * Credential preview inner message class (for V2)
 *
 * This is not a message but an inner object for other messages in this protocol. It is used construct a preview of the data for the credential.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0036-issue-credential/README.md#preview-credential
 */
export class V2CredentialPreview extends V1CredentialPreview {

  public constructor(options: CredentialPreviewOptions) {
    super(options)
  }

  @Expose({ name: '@type' })
  @Equals(V2CredentialPreview.type)
  @Transform(({ value }) => replaceLegacyDidSovPrefix(value), {
    toClassOnly: true,
  })
  public type = V2CredentialPreview.type
  public static type = `https://didcomm.org/issue-credential/2.0/credential-preview`
}
