export const SECURITY_V3_UNSTABLE = {
  '@context': [
    {
      '@version': 1.1,
      id: '@id',
      type: '@type',
      '@protected': true,
      JsonWebKey2020: { '@id': 'https://w3id.org/security#JsonWebKey2020' },
      JsonWebSignature2020: {
        '@id': 'https://w3id.org/security#JsonWebSignature2020',
        '@context': {
          '@version': 1.1,
          id: '@id',
          type: '@type',
          '@protected': true,
          challenge: 'https://w3id.org/security#challenge',
          created: {
            '@id': 'http://purl.org/dc/terms/created',
            '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
          },
          domain: 'https://w3id.org/security#domain',
          expires: {
            '@id': 'https://w3id.org/security#expiration',
            '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
          },
          jws: 'https://w3id.org/security#jws',
          nonce: 'https://w3id.org/security#nonce',
          proofPurpose: {
            '@id': 'https://w3id.org/security#proofPurpose',
            '@type': '@vocab',
            '@context': {
              '@version': 1.1,
              '@protected': true,
              id: '@id',
              type: '@type',
              assertionMethod: {
                '@id': 'https://w3id.org/security#assertionMethod',
                '@type': '@id',
                '@container': '@set',
              },
              authentication: {
                '@id': 'https://w3id.org/security#authenticationMethod',
                '@type': '@id',
                '@container': '@set',
              },
              capabilityInvocation: {
                '@id': 'https://w3id.org/security#capabilityInvocationMethod',
                '@type': '@id',
                '@container': '@set',
              },
              capabilityDelegation: {
                '@id': 'https://w3id.org/security#capabilityDelegationMethod',
                '@type': '@id',
                '@container': '@set',
              },
              keyAgreement: {
                '@id': 'https://w3id.org/security#keyAgreementMethod',
                '@type': '@id',
                '@container': '@set',
              },
            },
          },
          verificationMethod: {
            '@id': 'https://w3id.org/security#verificationMethod',
            '@type': '@id',
          },
        },
      },
      Ed25519VerificationKey2020: {
        '@id': 'https://w3id.org/security#Ed25519VerificationKey2020',
      },
      Ed25519Signature2020: {
        '@id': 'https://w3id.org/security#Ed25519Signature2020',
        '@context': {
          '@protected': true,
          id: '@id',
          type: '@type',
          challenge: 'https://w3id.org/security#challenge',
          created: {
            '@id': 'http://purl.org/dc/terms/created',
            '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
          },
          domain: 'https://w3id.org/security#domain',
          expires: {
            '@id': 'https://w3id.org/security#expiration',
            '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
          },
          nonce: 'https://w3id.org/security#nonce',
          proofPurpose: {
            '@id': 'https://w3id.org/security#proofPurpose',
            '@type': '@vocab',
            '@context': {
              '@version': 1.1,
              '@protected': true,
              id: '@id',
              type: '@type',
              assertionMethod: {
                '@id': 'https://w3id.org/security#assertionMethod',
                '@type': '@id',
                '@container': '@set',
              },
              authentication: {
                '@id': 'https://w3id.org/security#authenticationMethod',
                '@type': '@id',
                '@container': '@set',
              },
              capabilityInvocation: {
                '@id': 'https://w3id.org/security#capabilityInvocationMethod',
                '@type': '@id',
                '@container': '@set',
              },
              capabilityDelegation: {
                '@id': 'https://w3id.org/security#capabilityDelegationMethod',
                '@type': '@id',
                '@container': '@set',
              },
              keyAgreement: {
                '@id': 'https://w3id.org/security#keyAgreementMethod',
                '@type': '@id',
                '@container': '@set',
              },
            },
          },
          proofValue: {
            '@id': 'https://w3id.org/security#proofValue',
            '@type': 'https://w3id.org/security#multibase',
          },
          verificationMethod: {
            '@id': 'https://w3id.org/security#verificationMethod',
            '@type': '@id',
          },
        },
      },
      publicKeyJwk: {
        '@id': 'https://w3id.org/security#publicKeyJwk',
        '@type': '@json',
      },
      ethereumAddress: { '@id': 'https://w3id.org/security#ethereumAddress' },
      publicKeyHex: { '@id': 'https://w3id.org/security#publicKeyHex' },
      blockchainAccountId: {
        '@id': 'https://w3id.org/security#blockchainAccountId',
      },
      MerkleProof2019: { '@id': 'https://w3id.org/security#MerkleProof2019' },
      Bls12381G1Key2020: { '@id': 'https://w3id.org/security#Bls12381G1Key2020' },
      Bls12381G2Key2020: { '@id': 'https://w3id.org/security#Bls12381G2Key2020' },
      BbsBlsSignature2020: {
        '@id': 'https://w3id.org/security#BbsBlsSignature2020',
        '@context': {
          '@protected': true,
          id: '@id',
          type: '@type',
          challenge: 'https://w3id.org/security#challenge',
          created: {
            '@id': 'http://purl.org/dc/terms/created',
            '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
          },
          domain: 'https://w3id.org/security#domain',
          nonce: 'https://w3id.org/security#nonce',
          proofPurpose: {
            '@id': 'https://w3id.org/security#proofPurpose',
            '@type': '@vocab',
            '@context': {
              '@version': 1.1,
              '@protected': true,
              id: '@id',
              type: '@type',
              assertionMethod: {
                '@id': 'https://w3id.org/security#assertionMethod',
                '@type': '@id',
                '@container': '@set',
              },
              authentication: {
                '@id': 'https://w3id.org/security#authenticationMethod',
                '@type': '@id',
                '@container': '@set',
              },
              capabilityInvocation: {
                '@id': 'https://w3id.org/security#capabilityInvocationMethod',
                '@type': '@id',
                '@container': '@set',
              },
              capabilityDelegation: {
                '@id': 'https://w3id.org/security#capabilityDelegationMethod',
                '@type': '@id',
                '@container': '@set',
              },
              keyAgreement: {
                '@id': 'https://w3id.org/security#keyAgreementMethod',
                '@type': '@id',
                '@container': '@set',
              },
            },
          },
          proofValue: 'https://w3id.org/security#proofValue',
          verificationMethod: {
            '@id': 'https://w3id.org/security#verificationMethod',
            '@type': '@id',
          },
        },
      },
      BbsBlsSignatureProof2020: {
        '@id': 'https://w3id.org/security#BbsBlsSignatureProof2020',
        '@context': {
          '@protected': true,
          id: '@id',
          type: '@type',
          challenge: 'https://w3id.org/security#challenge',
          created: {
            '@id': 'http://purl.org/dc/terms/created',
            '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
          },
          domain: 'https://w3id.org/security#domain',
          nonce: 'https://w3id.org/security#nonce',
          proofPurpose: {
            '@id': 'https://w3id.org/security#proofPurpose',
            '@type': '@vocab',
            '@context': {
              '@version': 1.1,
              '@protected': true,
              id: '@id',
              type: '@type',
              assertionMethod: {
                '@id': 'https://w3id.org/security#assertionMethod',
                '@type': '@id',
                '@container': '@set',
              },
              authentication: {
                '@id': 'https://w3id.org/security#authenticationMethod',
                '@type': '@id',
                '@container': '@set',
              },
              capabilityInvocation: {
                '@id': 'https://w3id.org/security#capabilityInvocationMethod',
                '@type': '@id',
                '@container': '@set',
              },
              capabilityDelegation: {
                '@id': 'https://w3id.org/security#capabilityDelegationMethod',
                '@type': '@id',
                '@container': '@set',
              },
              keyAgreement: {
                '@id': 'https://w3id.org/security#keyAgreementMethod',
                '@type': '@id',
                '@container': '@set',
              },
            },
          },
          proofValue: 'https://w3id.org/security#proofValue',
          verificationMethod: {
            '@id': 'https://w3id.org/security#verificationMethod',
            '@type': '@id',
          },
        },
      },
      EcdsaKoblitzSignature2016: 'https://w3id.org/security#EcdsaKoblitzSignature2016',
      Ed25519Signature2018: {
        '@id': 'https://w3id.org/security#Ed25519Signature2018',
        '@context': {
          '@protected': true,
          id: '@id',
          type: '@type',
          challenge: 'https://w3id.org/security#challenge',
          created: {
            '@id': 'http://purl.org/dc/terms/created',
            '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
          },
          domain: 'https://w3id.org/security#domain',
          expires: {
            '@id': 'https://w3id.org/security#expiration',
            '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
          },
          jws: 'https://w3id.org/security#jws',
          nonce: 'https://w3id.org/security#nonce',
          proofPurpose: {
            '@id': 'https://w3id.org/security#proofPurpose',
            '@type': '@vocab',
            '@context': {
              '@version': 1.1,
              '@protected': true,
              id: '@id',
              type: '@type',
              assertionMethod: {
                '@id': 'https://w3id.org/security#assertionMethod',
                '@type': '@id',
                '@container': '@set',
              },
              authentication: {
                '@id': 'https://w3id.org/security#authenticationMethod',
                '@type': '@id',
                '@container': '@set',
              },
              capabilityInvocation: {
                '@id': 'https://w3id.org/security#capabilityInvocationMethod',
                '@type': '@id',
                '@container': '@set',
              },
              capabilityDelegation: {
                '@id': 'https://w3id.org/security#capabilityDelegationMethod',
                '@type': '@id',
                '@container': '@set',
              },
              keyAgreement: {
                '@id': 'https://w3id.org/security#keyAgreementMethod',
                '@type': '@id',
                '@container': '@set',
              },
            },
          },
          proofValue: 'https://w3id.org/security#proofValue',
          verificationMethod: {
            '@id': 'https://w3id.org/security#verificationMethod',
            '@type': '@id',
          },
        },
      },
      EncryptedMessage: 'https://w3id.org/security#EncryptedMessage',
      GraphSignature2012: 'https://w3id.org/security#GraphSignature2012',
      LinkedDataSignature2015: 'https://w3id.org/security#LinkedDataSignature2015',
      LinkedDataSignature2016: 'https://w3id.org/security#LinkedDataSignature2016',
      CryptographicKey: 'https://w3id.org/security#Key',
      authenticationTag: 'https://w3id.org/security#authenticationTag',
      canonicalizationAlgorithm: 'https://w3id.org/security#canonicalizationAlgorithm',
      cipherAlgorithm: 'https://w3id.org/security#cipherAlgorithm',
      cipherData: 'https://w3id.org/security#cipherData',
      cipherKey: 'https://w3id.org/security#cipherKey',
      created: {
        '@id': 'http://purl.org/dc/terms/created',
        '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
      },
      creator: { '@id': 'http://purl.org/dc/terms/creator', '@type': '@id' },
      digestAlgorithm: 'https://w3id.org/security#digestAlgorithm',
      digestValue: 'https://w3id.org/security#digestValue',
      domain: 'https://w3id.org/security#domain',
      encryptionKey: 'https://w3id.org/security#encryptionKey',
      expiration: {
        '@id': 'https://w3id.org/security#expiration',
        '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
      },
      expires: {
        '@id': 'https://w3id.org/security#expiration',
        '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
      },
      initializationVector: 'https://w3id.org/security#initializationVector',
      iterationCount: 'https://w3id.org/security#iterationCount',
      nonce: 'https://w3id.org/security#nonce',
      normalizationAlgorithm: 'https://w3id.org/security#normalizationAlgorithm',
      owner: 'https://w3id.org/security#owner',
      password: 'https://w3id.org/security#password',
      privateKey: 'https://w3id.org/security#privateKey',
      privateKeyPem: 'https://w3id.org/security#privateKeyPem',
      publicKey: 'https://w3id.org/security#publicKey',
      publicKeyBase58: 'https://w3id.org/security#publicKeyBase58',
      publicKeyPem: 'https://w3id.org/security#publicKeyPem',
      publicKeyWif: 'https://w3id.org/security#publicKeyWif',
      publicKeyService: 'https://w3id.org/security#publicKeyService',
      revoked: {
        '@id': 'https://w3id.org/security#revoked',
        '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
      },
      salt: 'https://w3id.org/security#salt',
      signature: 'https://w3id.org/security#signature',
      signatureAlgorithm: 'https://w3id.org/security#signingAlgorithm',
      signatureValue: 'https://w3id.org/security#signatureValue',
      proofValue: 'https://w3id.org/security#proofValue',
      AesKeyWrappingKey2019: 'https://w3id.org/security#AesKeyWrappingKey2019',
      DeleteKeyOperation: 'https://w3id.org/security#DeleteKeyOperation',
      DeriveSecretOperation: 'https://w3id.org/security#DeriveSecretOperation',
      EcdsaSecp256k1Signature2019: {
        '@id': 'https://w3id.org/security#EcdsaSecp256k1Signature2019',
        '@context': {
          '@protected': true,
          id: '@id',
          type: '@type',
          challenge: 'https://w3id.org/security#challenge',
          created: {
            '@id': 'http://purl.org/dc/terms/created',
            '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
          },
          domain: 'https://w3id.org/security#domain',
          expires: {
            '@id': 'https://w3id.org/security#expiration',
            '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
          },
          jws: 'https://w3id.org/security#jws',
          nonce: 'https://w3id.org/security#nonce',
          proofPurpose: {
            '@id': 'https://w3id.org/security#proofPurpose',
            '@type': '@vocab',
            '@context': {
              '@version': 1.1,
              '@protected': true,
              id: '@id',
              type: '@type',
              assertionMethod: {
                '@id': 'https://w3id.org/security#assertionMethod',
                '@type': '@id',
                '@container': '@set',
              },
              authentication: {
                '@id': 'https://w3id.org/security#authenticationMethod',
                '@type': '@id',
                '@container': '@set',
              },
              capabilityInvocation: {
                '@id': 'https://w3id.org/security#capabilityInvocationMethod',
                '@type': '@id',
                '@container': '@set',
              },
              capabilityDelegation: {
                '@id': 'https://w3id.org/security#capabilityDelegationMethod',
                '@type': '@id',
                '@container': '@set',
              },
              keyAgreement: {
                '@id': 'https://w3id.org/security#keyAgreementMethod',
                '@type': '@id',
                '@container': '@set',
              },
            },
          },
          proofValue: 'https://w3id.org/security#proofValue',
          verificationMethod: {
            '@id': 'https://w3id.org/security#verificationMethod',
            '@type': '@id',
          },
        },
      },
      EcdsaSecp256r1Signature2019: {
        '@id': 'https://w3id.org/security#EcdsaSecp256r1Signature2019',
        '@context': {
          '@protected': true,
          id: '@id',
          type: '@type',
          challenge: 'https://w3id.org/security#challenge',
          created: {
            '@id': 'http://purl.org/dc/terms/created',
            '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
          },
          domain: 'https://w3id.org/security#domain',
          expires: {
            '@id': 'https://w3id.org/security#expiration',
            '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
          },
          jws: 'https://w3id.org/security#jws',
          nonce: 'https://w3id.org/security#nonce',
          proofPurpose: {
            '@id': 'https://w3id.org/security#proofPurpose',
            '@type': '@vocab',
            '@context': {
              '@version': 1.1,
              '@protected': true,
              id: '@id',
              type: '@type',
              assertionMethod: {
                '@id': 'https://w3id.org/security#assertionMethod',
                '@type': '@id',
                '@container': '@set',
              },
              authentication: {
                '@id': 'https://w3id.org/security#authenticationMethod',
                '@type': '@id',
                '@container': '@set',
              },
              capabilityInvocation: {
                '@id': 'https://w3id.org/security#capabilityInvocationMethod',
                '@type': '@id',
                '@container': '@set',
              },
              capabilityDelegation: {
                '@id': 'https://w3id.org/security#capabilityDelegationMethod',
                '@type': '@id',
                '@container': '@set',
              },
              keyAgreement: {
                '@id': 'https://w3id.org/security#keyAgreementMethod',
                '@type': '@id',
                '@container': '@set',
              },
            },
          },
          proofValue: 'https://w3id.org/security#proofValue',
          verificationMethod: {
            '@id': 'https://w3id.org/security#verificationMethod',
            '@type': '@id',
          },
        },
      },
      EcdsaSecp256k1VerificationKey2019: 'https://w3id.org/security#EcdsaSecp256k1VerificationKey2019',
      EcdsaSecp256r1VerificationKey2019: 'https://w3id.org/security#EcdsaSecp256r1VerificationKey2019',
      Ed25519VerificationKey2018: 'https://w3id.org/security#Ed25519VerificationKey2018',
      EquihashProof2018: 'https://w3id.org/security#EquihashProof2018',
      ExportKeyOperation: 'https://w3id.org/security#ExportKeyOperation',
      GenerateKeyOperation: 'https://w3id.org/security#GenerateKeyOperation',
      KmsOperation: 'https://w3id.org/security#KmsOperation',
      RevokeKeyOperation: 'https://w3id.org/security#RevokeKeyOperation',
      RsaSignature2018: {
        '@id': 'https://w3id.org/security#RsaSignature2018',
        '@context': {
          '@protected': true,
          challenge: 'https://w3id.org/security#challenge',
          created: {
            '@id': 'http://purl.org/dc/terms/created',
            '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
          },
          domain: 'https://w3id.org/security#domain',
          expires: {
            '@id': 'https://w3id.org/security#expiration',
            '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
          },
          jws: 'https://w3id.org/security#jws',
          nonce: 'https://w3id.org/security#nonce',
          proofPurpose: {
            '@id': 'https://w3id.org/security#proofPurpose',
            '@type': '@vocab',
            '@context': {
              '@version': 1.1,
              '@protected': true,
              id: '@id',
              type: '@type',
              assertionMethod: {
                '@id': 'https://w3id.org/security#assertionMethod',
                '@type': '@id',
                '@container': '@set',
              },
              authentication: {
                '@id': 'https://w3id.org/security#authenticationMethod',
                '@type': '@id',
                '@container': '@set',
              },
              capabilityInvocation: {
                '@id': 'https://w3id.org/security#capabilityInvocationMethod',
                '@type': '@id',
                '@container': '@set',
              },
              capabilityDelegation: {
                '@id': 'https://w3id.org/security#capabilityDelegationMethod',
                '@type': '@id',
                '@container': '@set',
              },
              keyAgreement: {
                '@id': 'https://w3id.org/security#keyAgreementMethod',
                '@type': '@id',
                '@container': '@set',
              },
            },
          },
          proofValue: 'https://w3id.org/security#proofValue',
          verificationMethod: {
            '@id': 'https://w3id.org/security#verificationMethod',
            '@type': '@id',
          },
        },
      },
      RsaVerificationKey2018: 'https://w3id.org/security#RsaVerificationKey2018',
      Sha256HmacKey2019: 'https://w3id.org/security#Sha256HmacKey2019',
      SignOperation: 'https://w3id.org/security#SignOperation',
      UnwrapKeyOperation: 'https://w3id.org/security#UnwrapKeyOperation',
      VerifyOperation: 'https://w3id.org/security#VerifyOperation',
      WrapKeyOperation: 'https://w3id.org/security#WrapKeyOperation',
      X25519KeyAgreementKey2019: 'https://w3id.org/security#X25519KeyAgreementKey2019',
      allowedAction: 'https://w3id.org/security#allowedAction',
      assertionMethod: {
        '@id': 'https://w3id.org/security#assertionMethod',
        '@type': '@id',
        '@container': '@set',
      },
      authentication: {
        '@id': 'https://w3id.org/security#authenticationMethod',
        '@type': '@id',
        '@container': '@set',
      },
      capability: {
        '@id': 'https://w3id.org/security#capability',
        '@type': '@id',
      },
      capabilityAction: 'https://w3id.org/security#capabilityAction',
      capabilityChain: {
        '@id': 'https://w3id.org/security#capabilityChain',
        '@type': '@id',
        '@container': '@list',
      },
      capabilityDelegation: {
        '@id': 'https://w3id.org/security#capabilityDelegationMethod',
        '@type': '@id',
        '@container': '@set',
      },
      capabilityInvocation: {
        '@id': 'https://w3id.org/security#capabilityInvocationMethod',
        '@type': '@id',
        '@container': '@set',
      },
      caveat: {
        '@id': 'https://w3id.org/security#caveat',
        '@type': '@id',
        '@container': '@set',
      },
      challenge: 'https://w3id.org/security#challenge',
      ciphertext: 'https://w3id.org/security#ciphertext',
      controller: {
        '@id': 'https://w3id.org/security#controller',
        '@type': '@id',
      },
      delegator: { '@id': 'https://w3id.org/security#delegator', '@type': '@id' },
      equihashParameterK: {
        '@id': 'https://w3id.org/security#equihashParameterK',
        '@type': 'http://www.w3.org/2001/XMLSchema#:integer',
      },
      equihashParameterN: {
        '@id': 'https://w3id.org/security#equihashParameterN',
        '@type': 'http://www.w3.org/2001/XMLSchema#:integer',
      },
      invocationTarget: {
        '@id': 'https://w3id.org/security#invocationTarget',
        '@type': '@id',
      },
      invoker: { '@id': 'https://w3id.org/security#invoker', '@type': '@id' },
      jws: 'https://w3id.org/security#jws',
      keyAgreement: {
        '@id': 'https://w3id.org/security#keyAgreementMethod',
        '@type': '@id',
        '@container': '@set',
      },
      kmsModule: { '@id': 'https://w3id.org/security#kmsModule' },
      parentCapability: {
        '@id': 'https://w3id.org/security#parentCapability',
        '@type': '@id',
      },
      plaintext: 'https://w3id.org/security#plaintext',
      proof: {
        '@id': 'https://w3id.org/security#proof',
        '@type': '@id',
        '@container': '@graph',
      },
      proofPurpose: {
        '@id': 'https://w3id.org/security#proofPurpose',
        '@type': '@vocab',
        '@context': {
          '@version': 1.1,
          '@protected': true,
          id: '@id',
          type: '@type',
          assertionMethod: {
            '@id': 'https://w3id.org/security#assertionMethod',
            '@type': '@id',
            '@container': '@set',
          },
          authentication: {
            '@id': 'https://w3id.org/security#authenticationMethod',
            '@type': '@id',
            '@container': '@set',
          },
          capabilityInvocation: {
            '@id': 'https://w3id.org/security#capabilityInvocationMethod',
            '@type': '@id',
            '@container': '@set',
          },
          capabilityDelegation: {
            '@id': 'https://w3id.org/security#capabilityDelegationMethod',
            '@type': '@id',
            '@container': '@set',
          },
          keyAgreement: {
            '@id': 'https://w3id.org/security#keyAgreementMethod',
            '@type': '@id',
            '@container': '@set',
          },
        },
      },
      referenceId: 'https://w3id.org/security#referenceId',
      unwrappedKey: 'https://w3id.org/security#unwrappedKey',
      verificationMethod: {
        '@id': 'https://w3id.org/security#verificationMethod',
        '@type': '@id',
      },
      verifyData: 'https://w3id.org/security#verifyData',
      wrappedKey: 'https://w3id.org/security#wrappedKey',
    },
  ],
}
