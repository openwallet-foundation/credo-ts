import { sha256 } from 'js-sha256';
import BigNumber from 'bn.js';
import { CredentialPreview } from './messages/CredentialOfferMessage';

export class CredentialUtils {
  /**
   * Converts int value to string
   * Converts string value:
   * - hash with sha256,
   * - convert to byte array and reverse it
   * - convert it to BigInteger and return as a string
   * @param credentialPreview
   *
   * @returns CredValues
   */
  public static convertPreviewToValues(credentialPreview: CredentialPreview): CredValues {
    return credentialPreview.attributes.reduce((credentialValues, attribute) => {
      return {
        [attribute.name]: {
          raw: attribute.value,
          encoded: CredentialUtils.encode(attribute.value),
        },
        ...credentialValues,
      };
    }, {});
  }

  private static encode(value: any) {
    if (!isNaN(value)) {
      return value.toString();
    }

    return new BigNumber(sha256.array(value)).toString();
  }
}
