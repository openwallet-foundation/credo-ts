import type { PresentationDefinitionV1 } from '@sphereon/pex-models'

export const multipleCredentialPresentationDefinition: PresentationDefinitionV1 = {
  id: '022c2664-68cc-45cc-b291-789ce8b599eb',
  purpose: 'We want to know your name and e-mail address (will not be stored)',
  input_descriptors: [
    {
      id: 'c2834d0e-3c95-4721-b21a-40e3d7ea2549',
      name: 'DBC Conference 2023 Attendee',
      purpose: 'To access this portal your DBC Conference 2023 attendance proof is required.',
      group: ['A'],
      schema: [
        {
          uri: 'DBCConferenceAttendee',
          required: true,
        },
      ],
      constraints: {
        fields: [
          {
            path: ['$.credentialSubject.event.name', '$.vc.credentialSubject.event.name'],
            filter: {
              type: 'string',
              pattern: 'DBC Conference 2023',
            },
          },
        ],
      },
    },
    {
      id: 'c2834d0e-3c95-4721-b21a-40e3d7ea2549',
      name: 'Drivers licence',
      purpose:
        'Your drivers license is needed to validate your birth date. We do this to prevent fraud with conference tickets.',
      group: ['A'],
      schema: [
        {
          uri: 'NotPresent',
          required: true,
        },
      ],
    },
  ],
  submission_requirements: [
    {
      rule: 'pick',
      count: 2,
      from: 'A',
    },
  ],
}

export const dbcPresentationDefinition: PresentationDefinitionV1 = {
  id: '022c2664-68cc-45cc-b291-789ce8b599eb',
  purpose: 'We want to know your name and e-mail address (will not be stored)',
  input_descriptors: [
    {
      id: 'c2834d0e-3c95-4721-b21a-40e3d7ea2549',
      name: 'DBC Conference 2023 Attendee',
      purpose: 'To access this portal your DBC Conference 2023 attendance proof is required.',
      group: ['A'],
      schema: [
        {
          uri: 'DBCConferenceAttendee',
          required: true,
        },
      ],
    },
  ],
  submission_requirements: [
    {
      rule: 'all',
      from: 'A',
    },
  ],
}
