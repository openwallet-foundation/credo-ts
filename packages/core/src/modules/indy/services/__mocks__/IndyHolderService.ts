import type { CreateCredentialRequestOptions, StoreCredentialOptions } from '../IndyHolderService'

export const IndyHolderService = jest.fn(() => ({
  storeCredential: jest.fn(({ credentialId }: StoreCredentialOptions) =>
    Promise.resolve(credentialId ?? 'some-random-uuid')
  ),
  deleteCredential: jest.fn(() => Promise.resolve()),
  createCredentialRequest: jest.fn(({ holderDid, credentialDefinition }: CreateCredentialRequestOptions) =>
    Promise.resolve([
      {
        prover_did: holderDid,
        cred_def_id: credentialDefinition.id,
        blinded_ms: {},
        blinded_ms_correctness_proof: {},
        nonce: 'nonce',
      },
      { cred_req: 'meta-data' },
    ])
  ),
}))
