export const DID_WEB_LAUNCHPAD = {
  id: 'did:web:launchpad.vii.electron.mattrlabs.io',
  '@context': ['https://w3.org/ns/did/v1', 'https://w3id.org/security/suites/ed25519-2018/v1'],
  verificationMethod: [
    {
      id: 'did:web:launchpad.vii.electron.mattrlabs.io#6BhFMCGTJg',
      type: 'Ed25519VerificationKey2018',
      controller: 'did:web:launchpad.vii.electron.mattrlabs.io',
      publicKeyBase58: '6BhFMCGTJg9DnpXZe7zbiTrtuwion5FVV6Z2NUpwDMVT',
    },
  ],
  keyAgreement: [
    {
      id: 'did:web:launchpad.vii.electron.mattrlabs.io#9eS8Tqsus1',
      type: 'X25519KeyAgreementKey2019',
      controller: 'did:web:launchpad.vii.electron.mattrlabs.io',
      publicKeyBase58: '9eS8Tqsus1uJmQpf37S8CnEeBrEehsC3qz8RMq67KoLB',
    },
  ],
  authentication: ['did:web:launchpad.vii.electron.mattrlabs.io#6BhFMCGTJg'],
  assertionMethod: ['did:web:launchpad.vii.electron.mattrlabs.io#6BhFMCGTJg'],
  capabilityDelegation: ['did:web:launchpad.vii.electron.mattrlabs.io#6BhFMCGTJg'],
  capabilityInvocation: ['did:web:launchpad.vii.electron.mattrlabs.io#6BhFMCGTJg'],
}
