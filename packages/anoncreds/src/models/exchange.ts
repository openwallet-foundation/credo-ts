// TODO: Maybe we can make this a bit more specific?
export type WalletQuery = Record<string, unknown>

export interface ReferentWalletQuery {
  [key: string]: WalletQuery
}

export interface NonRevokedInterval {
  from?: number
  to?: number
}

export interface AnonCredsCredentialOffer {
  schema_id: string
  cred_def_id: string
  nonce: string
  key_correctness_proof: Record<string, unknown>
}

export interface AnonCredsCredentialRequest {
  // TODO: Why is this needed? It is just used as context in Ursa, can be any string. Should we remove it?
  // Should we not make it did related?
  prover_did: string
  cred_def_id: string
  blinded_ms: Record<string, unknown>
  blinded_ms_correctness_proof: Record<string, unknown>
  nonce: string
}

export interface CredValue {
  raw: string
  encoded: string // Raw value as number in string
}

export interface AnonCredsCredential {
  schema_id: string
  cred_def_id: string
  rev_reg_id?: string
  values: Record<string, CredValue>
  signature: unknown
  signature_correctness_proof: unknown
}

export interface AnonCredsProof {
  requested_proof: {
    revealed_attrs: Record<
      string,
      {
        sub_proof_index: number
        raw: string
        encoded: string
      }
    >
    revealed_attr_groups: Record<
      string,
      {
        sub_proof_index: number
        values: {
          [key: string]: {
            raw: string
            encoded: string
          }
        }
      }
    >
    unrevealed_attrs: Record<
      string,
      {
        sub_proof_index: number
      }
    >
    self_attested_attrs: Record<string, string>

    requested_predicates: Record<string, { sub_proof_index: number }>
  }
  proof: any
  identifiers: Array<{
    schema_id: string
    cred_def_id: string
    rev_reg_id?: string
    timestamp?: number
  }>
}

export interface AnonCredsProofRequest {
  name: string
  version: string
  nonce: string
  requested_attributes: Record<
    string,
    {
      name?: string
      names?: string[]
      restrictions?: WalletQuery[]
      non_revoked?: NonRevokedInterval
    }
  >
  requested_predicates: Record<
    string,
    {
      name: string
      p_type: '>=' | '>' | '<=' | '<'
      p_value: number
      restrictions?: WalletQuery[]
      non_revoked?: NonRevokedInterval
    }
  >
  non_revoked?: NonRevokedInterval
  ver?: '1.0' | '2.0'
}
