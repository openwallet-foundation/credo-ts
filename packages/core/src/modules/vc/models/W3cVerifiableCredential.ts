import type { JsonObject } from '../../../types'
import type { W3cCredentialOptions } from './W3cCredential'

import { W3cCredential } from './W3cCredential'

export interface W3cVerifiableCredentialOptions extends W3cCredentialOptions {
  proof?: JsonObject
}

export class W3cVerifiableCredential extends W3cCredential {
  private _proof: JsonObject | null

  public constructor(options: W3cVerifiableCredentialOptions) {
    super(options)
    this._proof = options.proof ?? null
  }

  public get proof(): JsonObject | null {
    return this._proof
  }

  public set proof(proof: JsonObject | null) {
    this._proof = proof
  }
}
