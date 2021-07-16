export const IndyIssuerService = jest.fn(() => ({
  createCredential: jest.fn(() =>
    Promise.resolve([
      {
        schema_id: 'schema_id',
        cred_def_id: 'cred_def_id',
        rev_reg_def_id: 'rev_reg_def_id',
        values: {},
        signature: 'signature',
        signature_correctness_proof: 'signature_correctness_proof',
      },
      '1',
    ])
  ),

  createCredentialOffer: jest.fn((credentialDefinitionId: string) =>
    Promise.resolve({
      schema_id: 'aaa',
      cred_def_id: credentialDefinitionId,
      // Fields below can depend on Cred Def type
      nonce: 'nonce',
      key_correctness_proof: {},
    })
  ),
}))
