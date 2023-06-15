export const VC_REVOCATION_LIST_2020 = {
  '@context': {
    '@protected': true,
    RevocationList2020Credential: {
      '@id': 'https://w3id.org/vc-revocation-list-2020#RevocationList2020Credential',
      '@context': {
        '@protected': true,
        id: '@id',
        type: '@type',
        description: 'http://schema.org/description',
        name: 'http://schema.org/name',
      },
    },
    RevocationList2020: {
      '@id': 'https://w3id.org/vc-revocation-list-2020#RevocationList2020',
      '@context': {
        '@protected': true,
        id: '@id',
        type: '@type',
        encodedList: 'https://w3id.org/vc-revocation-list-2020#encodedList',
      },
    },
    RevocationList2020Status: {
      '@id': 'https://w3id.org/vc-revocation-list-2020#RevocationList2020Status',
      '@context': {
        '@protected': true,
        id: '@id',
        type: '@type',
        revocationListCredential: {
          '@id': 'https://w3id.org/vc-revocation-list-2020#revocationListCredential',
          '@type': '@id',
        },
        revocationListIndex: 'https://w3id.org/vc-revocation-list-2020#revocationListIndex',
      },
    },
  },
}
