import { Transform } from 'class-transformer';
import { validateOrReject } from 'class-validator';

import { ConnectionInvitationMessage } from './protocols/connections/ConnectionInvitationMessage';
import { JsonEncoder } from './utils/JsonEncoder';
import { JsonTransformer } from './utils/JsonTransformer';

/**
 * Create a `ConnectionInvitationMessage` instance from the `c_i` parameter of an URL
 *
 * @param invitationUrl invitation url containing c_i parameter
 *
 * @throws Error when url can not be decoded to JSON, or decoded message is not a valid `ConnectionInvitationMessage`
 */
export async function decodeInvitationFromUrl(invitationUrl: string): Promise<ConnectionInvitationMessage> {
  // TODO: properly extract c_i param from invitation URL
  const [, encodedInvitation] = invitationUrl.split('c_i=');
  const invitationJson = JsonEncoder.fromBase64(encodedInvitation);

  const invitation = JsonTransformer.fromJSON(invitationJson, ConnectionInvitationMessage);

  // TODO: should validation happen here?
  await validateOrReject(invitation);

  return invitation;
}

/**
 * Create an invitation url from this instance
 *
 * @param invitation invitation message
 * @param domain domain name to use for invitation url
 */
export function encodeInvitationToUrl(
  invitation: ConnectionInvitationMessage,
  domain = 'https://example.com/ssi'
): string {
  const invitationJson = JsonTransformer.toJSON(invitation);
  const encodedInvitation = JsonEncoder.toBase64URL(invitationJson);
  const invitationUrl = `${domain}?c_i=${encodedInvitation}`;

  return invitationUrl;
}

/**
 * Provide a default value for a parameter when using class-transformer
 *
 * Class transfomer doesn't use the default value of a property when transforming an
 * object using `plainToClass`. This decorator allows to set a default value when no value is
 * present during transformation.
 *
 * @param defaultValue the default value to use when there is no value present during transformation
 * @see https://github.com/typestack/class-transformer/issues/129#issuecomment-425843700
 *
 * @example
 * import { plainToClass } from 'class-transformer'
 *
 * class Test {
 *  // doesn't work
 *  myProp = true;
 *
 *  // does work
 *  ＠Default(true)
 *  myDefaultProp: boolean;
 * }
 *
 * plainToClass(Test, {})
 * // results in
 * {
 *   "myProp": undefined,
 *   "myDefaultProp": true
 * }
 */
export function Default<T>(defaultValue: T) {
  return Transform((value: T | null | undefined) => (value !== null && value !== undefined ? value : defaultValue));
}
