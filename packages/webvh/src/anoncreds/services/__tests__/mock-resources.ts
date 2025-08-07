export const issuerDid =
  'did:webvh:QmRxso8yoATm66gKhp3AKbPSH6ys4XcNVgKT786M99JRpN:id.anoncreds.vc:demo:863862bf-cd3b-44e3-89d4-0a2d7f5cc8d4'

export const mockSchemaResource = {
  '@context': ['https://w3id.org/security/data-integrity/v2'],
  type: ['AttestedResource'],
  id: 'did:webvh:QmRxso8yoATm66gKhp3AKbPSH6ys4XcNVgKT786M99JRpN:id.anoncreds.vc:demo:863862bf-cd3b-44e3-89d4-0a2d7f5cc8d4/resources/zQmc3ZT6N3s3UhqTcC5kWcWVoHwnkK6dZVBVfkLtYKY8YJm',
  content: {
    issuerId:
      'did:webvh:QmRxso8yoATm66gKhp3AKbPSH6ys4XcNVgKT786M99JRpN:id.anoncreds.vc:demo:863862bf-cd3b-44e3-89d4-0a2d7f5cc8d4',
    attrNames: ['group', 'email', 'date'],
    name: 'Meeting Invitation',
    version: '1.1',
  },
  metadata: {
    resourceId: 'zQmc3ZT6N3s3UhqTcC5kWcWVoHwnkK6dZVBVfkLtYKY8YJm',
    resourceType: 'anonCredsSchema',
    resourceName: 'Meeting Invitation',
  },
  proof: {
    type: 'DataIntegrityProof',
    cryptosuite: 'eddsa-jcs-2022',
    proofPurpose: 'assertionMethod',
    proofValue: 'z4RCLxRSVeTM4UnZ6vDmDjEX9pbpdUptXuDTy7h8Fij2npReHXmCUzzb5jTEUg1dFtpjH7tiKNJwXztwSktdjaMtX',
    verificationMethod:
      'did:webvh:QmRxso8yoATm66gKhp3AKbPSH6ys4XcNVgKT786M99JRpN:id.anoncreds.vc:demo:863862bf-cd3b-44e3-89d4-0a2d7f5cc8d4#key-01',
  },
}

export const mockCredDefResource = {
  '@context': ['https://w3id.org/security/data-integrity/v2'],
  type: ['AttestedResource'],
  id: 'did:webvh:QmRxso8yoATm66gKhp3AKbPSH6ys4XcNVgKT786M99JRpN:id.anoncreds.vc:demo:863862bf-cd3b-44e3-89d4-0a2d7f5cc8d4/resources/zQmVrh8pxBhaieoJZG8syFUm3axcC928JrE1gaWo9EBVWMM',
  content: {
    issuerId:
      'did:webvh:QmRxso8yoATm66gKhp3AKbPSH6ys4XcNVgKT786M99JRpN:id.anoncreds.vc:demo:863862bf-cd3b-44e3-89d4-0a2d7f5cc8d4',
    schemaId:
      'did:webvh:QmRxso8yoATm66gKhp3AKbPSH6ys4XcNVgKT786M99JRpN:id.anoncreds.vc:demo:863862bf-cd3b-44e3-89d4-0a2d7f5cc8d4/resources/zQmc3ZT6N3s3UhqTcC5kWcWVoHwnkK6dZVBVfkLtYKY8YJm',
    type: 'CL',
    tag: 'Meeting Invitation',
    value: {},
  },
  metadata: {
    resourceId: 'zQmVrh8pxBhaieoJZG8syFUm3axcC928JrE1gaWo9EBVWMM',
    resourceType: 'anonCredsCredDef',
    resourceName: 'Meeting Invitation',
  },
  proof: {
    type: 'DataIntegrityProof',
    cryptosuite: 'eddsa-jcs-2022',
    proofPurpose: 'assertionMethod',
    proofValue: 'z2P3cR46Qt8r3Zc47EHxou6JkU7sTWd8PFZpQwZR7k8MU2Sntt325dQ1u3bn2ZoQUvoCFdNHWYbmsf5FzpqaF1n41',
    verificationMethod:
      'did:webvh:QmRxso8yoATm66gKhp3AKbPSH6ys4XcNVgKT786M99JRpN:id.anoncreds.vc:demo:863862bf-cd3b-44e3-89d4-0a2d7f5cc8d4#key-01',
  },
}

export const mockRevRegDefResource = {
  '@context': ['https://w3id.org/security/data-integrity/v2'],
  type: ['AttestedResource'],
  id: 'did:webvh:QmRxso8yoATm66gKhp3AKbPSH6ys4XcNVgKT786M99JRpN:id.anoncreds.vc:demo:863862bf-cd3b-44e3-89d4-0a2d7f5cc8d4/resources/zQmWnvUkdcwB3nHhAWyAdQ4Vh3WZwtoatK7rhLTVpABGMqt',
  content: {
    issuerId:
      'did:webvh:QmRxso8yoATm66gKhp3AKbPSH6ys4XcNVgKT786M99JRpN:id.anoncreds.vc:demo:863862bf-cd3b-44e3-89d4-0a2d7f5cc8d4',
    revocDefType: 'CL_ACCUM',
    credDefId:
      'did:webvh:QmRxso8yoATm66gKhp3AKbPSH6ys4XcNVgKT786M99JRpN:id.anoncreds.vc:demo:863862bf-cd3b-44e3-89d4-0a2d7f5cc8d4/resources/zQmVrh8pxBhaieoJZG8syFUm3axcC928JrE1gaWo9EBVWMM',
    tag: '0',
    value: {
      publicKeys: {
        accumKey: {
          z: '1 0030D63670F45350DA40A365D583E9F63DF8D354A0D413D0E6375A74619B990E 1 0D95E8FDB17C003B423BA2A525D0A0B19D9A60BCE8C661BC6FF508CD87FF1895 1 0D85DFD466C0D8D92C41F8D1F678D6CD86D3D6C3625CE2C91356C5B1E12A4560 1 00755055AE7B11333AAB9D96CB3997DF3A729971ED08FF3980A853BB7E115DAE 1 11DBDA475F2E240B8CC9B874A8ED7C061778C688BB73CB55D51BC8A47495DA4F 1 23815EC20DD84CE61102953818C475B5D4821A80D46CCEB664020CA1A22036A2 1 00FD1DD0A0767A3A3136BDA5FC6D8EC2D463F47E9DE0B2C8D5B16799EF6942B0 1 0896EDD64B8BAB579153B9E4BE73B9DA822C2D60B3D51886CA504DBC63CA8423 1 0C78EE9EAAB9137A33E580E9C9F40AB83670CD6B50F5EA63E5DD6C76617CCB73 1 1BE09416967802C5BF852CEF50E7DBD5EACA4E9F08D4F8E65F6E60A5332FD1AB 1 18C08D5EE58798D211CFF757323E20A5DBDB984CD0B3BCD5BAFF5B119E68F6B7 1 0FB0C9D143962D4A83587269003F125403E8CBAC14252CFA6B501FD577CB4BBF',
        },
      },
      maxCredNum: 100,
      tailsLocation: 'https://tails.anoncreds.vc/hash/H9YggRVzCkjeonb7VWnZfTxrfZGTvTn6oFtg8oizcCvt',
      tailsHash: 'H9YggRVzCkjeonb7VWnZfTxrfZGTvTn6oFtg8oizcCvt',
    },
  },
  metadata: {
    resourceId: 'zQmWnvUkdcwB3nHhAWyAdQ4Vh3WZwtoatK7rhLTVpABGMqt',
    resourceType: 'anonCredsRevocRegDef',
    resourceName: '0',
  },
  links: [
    {
      id: 'did:webvh:QmRxso8yoATm66gKhp3AKbPSH6ys4XcNVgKT786M99JRpN:id.anoncreds.vc:demo:863862bf-cd3b-44e3-89d4-0a2d7f5cc8d4/resources/zQmZPkNNca2RYyoeGhUoBkSzUeNm3vW4JDQd61c7YyFcqiA',
      type: 'anonCredsStatusList',
      timestamp: 1742002941,
    },
  ],
  proof: {
    type: 'DataIntegrityProof',
    cryptosuite: 'eddsa-jcs-2022',
    proofPurpose: 'assertionMethod',
    proofValue: 'z61CdZfYZbgwvNXV5KWFdTmoMyih9yJsmjdTb28JdY9qCiXZJ3t2cRUJCKaEV3Ummr3RrXiZGfDuFb1548GbU8iTU',
    verificationMethod:
      'did:webvh:QmRxso8yoATm66gKhp3AKbPSH6ys4XcNVgKT786M99JRpN:id.anoncreds.vc:demo:863862bf-cd3b-44e3-89d4-0a2d7f5cc8d4#key-01',
  },
}
