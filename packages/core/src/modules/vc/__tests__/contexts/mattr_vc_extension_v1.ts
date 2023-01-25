export const MATTR_VC_EXTENSION_V1 = {
  '@context': {
    '@version': 1.1,
    '@protected': true,
    VerifiableCredentialExtension: {
      '@id': 'https://mattr.global/contexts/vc-extensions/v1#VerifiableCredentialExtension',
      '@context': {
        '@version': 1.1,
        '@protected': true,
        id: '@id',
        type: '@type',
        name: 'https://mattr.global/contexts/vc-extensions/v1#name',
        description: 'https://mattr.global/contexts/vc-extensions/v1#description',
      },
    },
  },
}
