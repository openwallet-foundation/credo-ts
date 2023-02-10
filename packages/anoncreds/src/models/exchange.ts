export interface AnonCredsProofRequestRestriction {
  schema_id?: string
  schema_issuer_id?: string
  schema_name?: string
  schema_version?: string
  issuer_id?: string
  cred_def_id?: string
  rev_reg_id?: string

  // Deprecated, but kept for backwards compatibility with legacy indy anoncreds implementations
  schema_issuer_did?: string
  issuer_did?: string

  // the following keys can be used for every `attribute name` in credential.
  [key: `attr::${string}::marker`]: '1' | '0'
  [key: `attr::${string}::value`]: string
}

export interface AnonCredsNonRevokedInterval {
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
  // prover_did is deprecated, however it is kept for backwards compatibility with legacy anoncreds implementations
  prover_did?: string
  cred_def_id: string
  blinded_ms: Record<string, unknown>
  blinded_ms_correctness_proof: Record<string, unknown>
  nonce: string
}

export type AnonCredsCredentialValues = Record<string, AnonCredsCredentialValue>
export interface AnonCredsCredentialValue {
  raw: string
  encoded: string // Raw value as number in string
}

export interface AnonCredsCredential {
  schema_id: string
  cred_def_id: string
  rev_reg_id?: string
  values: Record<string, AnonCredsCredentialValue>
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
      restrictions?: AnonCredsProofRequestRestriction[]
      non_revoked?: AnonCredsNonRevokedInterval
    }
  >
  requested_predicates: Record<
    string,
    {
      name: string
      p_type: '>=' | '>' | '<=' | '<'
      p_value: number
      restrictions?: AnonCredsProofRequestRestriction[]
      non_revoked?: AnonCredsNonRevokedInterval
    }
  >
  non_revoked?: AnonCredsNonRevokedInterval
  ver?: '1.0' | '2.0'
}
