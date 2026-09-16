import { CredoError } from '../../../error'
import type { IDisclosureFrame } from '../../sd-jwt-vc'

/**
 * List of fields that cannot be selectively disclosed.
 *
 * @see https://www.w3.org/TR/vc-jose-cose/#securing-with-sd-jwt
 * @see https://www.w3.org/TR/vc-jose-cose/#securing-vps-sd-jwt
 */
export const NON_DISCLOSEABLE_FIELDS = [
  '@context',
  'type',
  'credentialStatus',
  'credentialSchema',
  'relatedResource',
] as const

/**
 * Asserts that a disclosure frame does not make any of the {@link NON_DISCLOSEABLE_FIELDS} of a W3C
 * VCDM 2.0 credential or presentation selectively disclosable.
 *
 * Only the top level of the frame is checked. A nested claim that happens to share a name with a
 * non-discloseable field, such as `credentialSubject.type`, may be selectively disclosed.
 */
export function validateW3cV2SdJwtDisclosureFrame(disclosureFrame?: IDisclosureFrame) {
  if (!disclosureFrame) return

  for (const field of NON_DISCLOSEABLE_FIELDS) {
    if (disclosureFrame[field]) {
      throw new CredoError(`'${field}' property cannot be selectively disclosed`)
    }

    if (Array.isArray(disclosureFrame._sd) && disclosureFrame._sd.includes(field)) {
      throw new CredoError(`'${field}' property cannot be selectively disclosed`)
    }
  }
}
