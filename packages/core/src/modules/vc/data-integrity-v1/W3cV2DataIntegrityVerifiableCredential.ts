import { CredoError } from '../../../error'
import { JsonTransformer, MessageValidator } from '../../../utils'
import { ClaimFormat } from '../models/ClaimFormat'
import { W3cV2Credential } from '../models/credential/W3cV2Credential'

export interface W3cV2DataIntegrityVerifiableCredentialOptions {
  securedCredential: Record<string, unknown> & { proof: unknown }
}

/**
 * Stub model for future DI VC support.
 *
 * This class intentionally provides shape compatibility only and does not
 * implement Data Integrity proof verification.
 */
export class W3cV2DataIntegrityVerifiableCredential {
  public constructor(options: W3cV2DataIntegrityVerifiableCredentialOptions) {
    this.securedCredential = options.securedCredential
    this.resolvedCredential = JsonTransformer.fromJSON(options.securedCredential, W3cV2Credential, {
      validate: false,
    })

    this.validate()
  }

  public static fromObject(credential: Record<string, unknown> & { proof: unknown }) {
    return new W3cV2DataIntegrityVerifiableCredential({
      securedCredential: credential,
    })
  }

  public readonly securedCredential: Record<string, unknown> & { proof: unknown }
  public readonly resolvedCredential: W3cV2Credential

  public get encoded() {
    return JSON.stringify(this.securedCredential)
  }

  public get claimFormat(): ClaimFormat.DiVc {
    return ClaimFormat.DiVc
  }

  public validate() {
    MessageValidator.validateSync(this.resolvedCredential)

    const proof = this.securedCredential.proof
    if (!proof || typeof proof !== 'object') {
      throw new CredoError('The provided Data Integrity credential must include a proof object or proof array.')
    }
  }
}
