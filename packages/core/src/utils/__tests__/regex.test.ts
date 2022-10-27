import { contactInvitationLabelRegex, credDefIdRegex, indyDidRegex, schemaIdRegex, schemaVersionRegex } from '../regex'

describe('Valid Regular Expression', () => {
  const invalidTest = 'test'

  test('test for credDefIdRegex', async () => {
    const test = 'q7ATwTYbQDgiigVijUAej:3:CL:160971:1.0.0'
    expect(test).toMatch(credDefIdRegex)
    expect(credDefIdRegex.test(invalidTest)).toBeFalsy()
  })

  test('test for indyDidRegex', async () => {
    const test = 'did:sov:q7ATwTYbQDgiigVijUAej'
    expect(test).toMatch(indyDidRegex)
    expect(indyDidRegex.test(invalidTest)).toBeFalsy()
  })

  test('test for schemaIdRegex', async () => {
    const test = 'q7ATwTYbQDgiigVijUAej:2:test:1.0'
    expect(test).toMatch(schemaIdRegex)
    expect(schemaIdRegex.test(invalidTest)).toBeFalsy()
  })

  test('test for schemaVersionRegex', async () => {
    const test = '1.0.0'
    expect(test).toMatch(schemaVersionRegex)
    expect(schemaVersionRegex.test(invalidTest)).toBeFalsy()
  })

  test('test for contactInvitationLabelRegex', () => {
    const bobInvitationGoal = 'Invitation from Bob to share contact'
    const bobMatch = bobInvitationGoal.match(contactInvitationLabelRegex)
    expect(bobMatch).toHaveLength(2)
    expect(bobMatch![1]).toBe('Bob')

    const emptyInvitationGoal = 'Invitation from to share contact'
    expect(contactInvitationLabelRegex.test(emptyInvitationGoal)).toBeFalsy()

    const emptyInvitationGoalWithWhitespaces = 'Invitation from      to share contact'
    const whitespacesMatch = emptyInvitationGoalWithWhitespaces.match(contactInvitationLabelRegex)
    expect(whitespacesMatch).toHaveLength(2)
    expect(whitespacesMatch![1]).toBeFalsy()

    expect(contactInvitationLabelRegex.test(invalidTest)).toBeFalsy()
  })
})
