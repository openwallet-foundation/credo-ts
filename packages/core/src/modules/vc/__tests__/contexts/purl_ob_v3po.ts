export const PURL_OB_V3P0 = {
  '@context': {
    id: '@id',
    type: '@type',
    xsd: 'https://www.w3.org/2001/XMLSchema#',
    OpenBadgeCredential: {
      '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#OpenBadgeCredential',
    },
    Achievement: {
      '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#Achievement',
      '@context': {
        achievementType: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#achievementType',
          '@type': 'xsd:string',
        },
        alignment: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#alignment',
          '@type': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#Alignment',
          '@container': '@set',
        },
        creator: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#Profile',
        },
        creditsAvailable: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#creditsAvailable',
          '@type': 'xsd:float',
        },
        criteria: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#Criteria',
          '@type': '@id',
        },
        fieldOfStudy: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#fieldOfStudy',
          '@type': 'xsd:string',
        },
        humanCode: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#humanCode',
          '@type': 'xsd:string',
        },
        otherIdentifier: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#otherIdentifier',
          '@type': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#IdentifierEntry',
          '@container': '@set',
        },
        related: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#related',
          '@type': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#Related',
          '@container': '@set',
        },
        resultDescription: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#resultDescription',
          '@type': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#ResultDescription',
          '@container': '@set',
        },
        specialization: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#specialization',
          '@type': 'xsd:string',
        },
        tag: {
          '@id': 'https://schema.org/keywords',
          '@type': 'xsd:string',
          '@container': '@set',
        },
        version: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#version',
          '@type': 'xsd:string',
        },
      },
    },
    AchievementCredential: {
      '@id': 'OpenBadgeCredential',
    },
    AchievementSubject: {
      '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#AchievementSubject',
      '@context': {
        achievement: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#Achievement',
        },
        activityEndDate: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#activityEndDate',
          '@type': 'xsd:date',
        },
        activityStartDate: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#activityStartDate',
          '@type': 'xsd:date',
        },
        creditsEarned: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#creditsEarned',
          '@type': 'xsd:float',
        },
        identifier: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#identifier',
          '@type': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#IdentityObject',
          '@container': '@set',
        },
        licenseNumber: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#licenseNumber',
          '@type': 'xsd:string',
        },
        result: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#result',
          '@type': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#Result',
          '@container': '@set',
        },
        role: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#role',
          '@type': 'xsd:string',
        },
        source: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#source',
          '@type': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#Profile',
        },
        term: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#term',
          '@type': 'xsd:string',
        },
      },
    },
    Address: {
      '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#Address',
      '@context': {
        addressCountry: {
          '@id': 'https://schema.org/addressCountry',
          '@type': 'xsd:string',
        },
        addressCountryCode: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#CountryCode',
          '@type': 'xsd:string',
        },
        addressLocality: {
          '@id': 'https://schema.org/addressLocality',
          '@type': 'xsd:string',
        },
        addressRegion: {
          '@id': 'https://schema.org/addressRegion',
          '@type': 'xsd:string',
        },
        geo: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#GeoCoordinates',
        },
        postOfficeBoxNumber: {
          '@id': 'https://schema.org/postOfficeBoxNumber',
          '@type': 'xsd:string',
        },
        postalCode: {
          '@id': 'https://schema.org/postalCode',
          '@type': 'xsd:string',
        },
        streetAddress: {
          '@id': 'https://schema.org/streetAddress',
          '@type': 'xsd:string',
        },
      },
    },
    Alignment: {
      '@id': 'https://schema.org/Alignment',
      '@context': {
        targetCode: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#targetCode',
          '@type': 'xsd:string',
        },
        targetDescription: {
          '@id': 'https://schema.org/targetDescription',
          '@type': 'xsd:string',
        },
        targetFramework: {
          '@id': 'https://schema.org/targetFramework',
          '@type': 'xsd:string',
        },
        targetName: {
          '@id': 'https://schema.org/targetName',
          '@type': 'xsd:string',
        },
        targetType: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#targetType',
          '@type': 'xsd:string',
        },
        targetUrl: {
          '@id': 'https://schema.org/targetUrl',
          '@type': 'xsd:anyURI',
        },
      },
    },
    Criteria: {
      '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#Criteria',
    },
    EndorsementCredential: {
      '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#EndorsementCredential',
    },
    EndorsementSubject: {
      '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#EndorsementSubject',
      '@context': {
        endorsementComment: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#endorsementComment',
          '@type': 'xsd:string',
        },
      },
    },
    Evidence: {
      '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#Evidence',
      '@context': {
        audience: {
          '@id': 'https://schema.org/audience',
          '@type': 'xsd:string',
        },
        genre: {
          '@id': 'https://schema.org/genre',
          '@type': 'xsd:string',
        },
      },
    },
    GeoCoordinates: {
      '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#GeoCoordinates',
      '@context': {
        latitude: {
          '@id': 'https://schema.org/latitude',
          '@type': 'xsd:string',
        },
        longitude: {
          '@id': 'https://schema.org/longitude',
          '@type': 'xsd:string',
        },
      },
    },
    IdentifierEntry: {
      '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#IdentifierEntry',
      '@context': {
        identifier: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#identifier',
          '@type': 'xsd:string',
        },
        identifierType: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#identifierType',
          '@type': 'xsd:string',
        },
      },
    },
    IdentityObject: {
      '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#IdentityObject',
      '@context': {
        hashed: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#hashed',
          '@type': 'xsd:boolean',
        },
        identityHash: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#identityHash',
          '@type': 'xsd:string',
        },
        identityType: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#identityType',
          '@type': 'xsd:string',
        },
        salt: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#salt',
          '@type': 'xsd:string',
        },
      },
    },
    Image: {
      '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#Image',
      '@context': {
        caption: {
          '@id': 'https://schema.org/caption',
          '@type': 'xsd:string',
        },
      },
    },
    Profile: {
      '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#Profile',
      '@context': {
        additionalName: {
          '@id': 'https://schema.org/additionalName',
          '@type': 'xsd:string',
        },
        address: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#Address',
        },
        dateOfBirth: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#dateOfBirth',
          '@type': 'xsd:date',
        },
        email: {
          '@id': 'https://schema.org/email',
          '@type': 'xsd:string',
        },
        familyName: {
          '@id': 'https://schema.org/familyName',
          '@type': 'xsd:string',
        },
        familyNamePrefix: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#familyNamePrefix',
          '@type': 'xsd:string',
        },
        givenName: {
          '@id': 'https://schema.org/givenName',
          '@type': 'xsd:string',
        },
        honorificPrefix: {
          '@id': 'https://schema.org/honorificPrefix',
          '@type': 'xsd:string',
        },
        honorificSuffix: {
          '@id': 'https://schema.org/honorificSuffix',
          '@type': 'xsd:string',
        },
        otherIdentifier: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#otherIdentifier',
          '@type': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#IdentifierEntry',
          '@container': '@set',
        },
        parentOrg: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#parentOrg',
          '@type': 'xsd:string',
        },
        patronymicName: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#patronymicName',
          '@type': 'xsd:string',
        },
        phone: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#PhoneNumber',
          '@type': 'xsd:string',
        },
        official: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#official',
          '@type': 'xsd:string',
        },
      },
    },
    Related: {
      '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#Related',
      '@context': {
        version: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#version',
          '@type': 'xsd:string',
        },
      },
    },
    Result: {
      '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#Result',
      '@context': {
        achievedLevel: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#achievedLevel',
          '@type': 'xsd:anyURI',
        },
        resultDescription: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#resultDescription',
          '@type': 'xsd:anyURI',
        },
        status: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#status',
          '@type': 'xsd:string',
        },
        value: {
          '@id': 'https://schema.org/value',
          '@type': 'xsd:string',
        },
      },
    },
    ResultDescription: {
      '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#ResultDescription',
      '@context': {
        allowedValue: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#allowedValue',
          '@type': 'xsd:string',
          '@container': '@set',
        },
        requiredLevel: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#requiredLevel',
          '@type': 'xsd:anyURI',
        },
        requiredValue: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#requiredValue',
          '@type': 'xsd:string',
        },
        resultType: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#resultType',
          '@type': 'xsd:string',
        },
        rubricCriterionLevel: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#rubricCriterionLevel',
          '@type': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#RubricCriterionLevel',
          '@container': '@set',
        },
        valueMax: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#valueMax',
          '@type': 'xsd:string',
        },
        valueMin: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#valueMin',
          '@type': 'xsd:string',
        },
      },
    },
    RubricCriterionLevel: {
      '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#RubricCriterionLevel',
      '@context': {
        level: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#level',
          '@type': 'xsd:string',
        },
        points: {
          '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#points',
          '@type': 'xsd:string',
        },
      },
    },
    alignment: {
      '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#alignment',
      '@type': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#Alignment',
      '@container': '@set',
    },
    description: {
      '@id': 'https://schema.org/description',
      '@type': 'xsd:string',
    },
    endorsement: {
      '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#endorsement',
      '@type': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#EndorsementCredential',
      '@container': '@set',
    },
    image: {
      '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#image',
      '@type': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#Image',
    },
    name: {
      '@id': 'https://schema.org/name',
      '@type': 'xsd:string',
    },
    narrative: {
      '@id': 'https://purl.imsglobal.org/spec/vc/ob/vocab.html#narrative',
      '@type': 'xsd:string',
    },
    url: {
      '@id': 'https://schema.org/url',
      '@type': 'xsd:anyURI',
    },
  },
}
