import { randomUUID } from 'crypto'
import { getAgentOptions } from '../../../../tests'
import { Agent } from '../../../agent/Agent'
import { PublicJwk } from '../../kms'
import { Mdoc, MdocDeviceResponse, MdocRecord, type MdocSessionTranscriptOptions } from '../../mdoc'
import { mdocIssuerP256Certificate, mdocIssuerP256PrivateJwk } from '../../mdoc/__tests__/mdoc.fixtures'
import { X509Certificate } from '../../x509'
import { DifPresentationExchangeService } from '../DifPresentationExchangeService'
import { type DifPresentationExchangeDefinitionV2, DifPresentationExchangeSubmissionLocation } from '../models'

/**
 * Proves that an mdoc is requested with the doctype that is the input descriptor id (ISO 18013-7), whatever the
 * doctype and the name spaces of its data elements, and that the device response holds the data elements the input
 * descriptor asks for, and no others.
 */

const agent = new Agent(getAgentOptions('pex-mdoc'))

describe('DIF Presentation Exchange mdoc', () => {
  let pexService: DifPresentationExchangeService
  let holderKey: PublicJwk
  let issuerCertificate: X509Certificate

  const mdocSessionTranscript: MdocSessionTranscriptOptions = {
    type: 'openId4VpDraft18',
    clientId: 'https://verifier.example.com',
    responseUri: 'https://verifier.example.com/response',
    verifierGeneratedNonce: 'challenge',
    mdocGeneratedNonce: 'mdoc-nonce',
  }

  beforeAll(async () => {
    await agent.initialize()
    pexService = agent.dependencyManager.resolve(DifPresentationExchangeService)

    holderKey = PublicJwk.fromPublicJwk((await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk)
    const issuerKey = await agent.kms.importKey({ privateJwk: mdocIssuerP256PrivateJwk })
    issuerCertificate = X509Certificate.fromEncodedCertificate(mdocIssuerP256Certificate)
    issuerCertificate.keyId = issuerKey.keyId
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  async function storeMdoc(docType: string, namespaces: Record<string, Record<string, unknown>>) {
    const mdoc = await Mdoc.sign(agent.context, {
      docType,
      validityInfo: {
        signed: new Date('2023-10-24'),
        validFrom: new Date('2023-10-24'),
        validUntil: new Date('2050-10-24'),
      },
      holderKey,
      issuerCertificate,
      namespaces,
    })
    await agent.mdoc.store({
      record: new MdocRecord({
        credentialInstances: [{ issuerSignedBase64Url: mdoc.base64Url, kmsKeyId: holderKey.keyId }],
      }),
    })
  }

  /**
   * Presents the mdoc the definition selects, checks the verifier accepts it, and returns the data elements of the
   * device response.
   */
  async function present(definition: DifPresentationExchangeDefinitionV2) {
    const queryResult = await pexService.getCredentialsForRequest(agent.context, definition)
    expect(queryResult.can_be_satisfied).toBe(true)

    const { verifiablePresentations, presentationSubmission } = await pexService.createPresentation(agent.context, {
      credentialsForInputDescriptor: pexService.selectCredentialsForRequest(queryResult),
      presentationDefinition: definition,
      presentationSubmissionLocation: DifPresentationExchangeSubmissionLocation.External,
      challenge: 'challenge',
      domain: 'https://verifier.example.com',
      mdocSessionTranscript,
    })

    const deviceResponse = verifiablePresentations[0] as MdocDeviceResponse
    await deviceResponse.verify(agent.context, {
      trustedCertificates: [mdocIssuerP256Certificate],
      sessionTranscriptOptions: mdocSessionTranscript,
    })
    pexService.validatePresentation(definition, verifiablePresentations, presentationSubmission)

    const [document] = deviceResponse.deviceResponse.documents ?? []
    return {
      docType: document.docType,
      nameSpaces: new Mdoc(document.issuerSigned).issuerSignedNamespaces,
      disclosure: queryResult.input_descriptors[0].matching_credentials[0].disclosure.output,
    }
  }

  const inputDescriptor = (id: string, paths: string[], optional: string[] = []) => ({
    id,
    format: { mso_mdoc: { alg: ['ES256'] } },
    constraints: {
      limit_disclosure: 'required' as const,
      fields: [
        ...paths.map((path) => ({ path: [path], intent_to_retain: false })),
        ...optional.map((path) => ({ path: [path], intent_to_retain: false, optional: true })),
      ],
    },
  })

  test('requests a doctype without org. that asks for ISO 18013-5 data elements', async () => {
    const docType = `com.example.${randomUUID()}`
    await storeMdoc(docType, {
      'org.iso.18013.5.1': { family_name: 'Jones', given_name: 'Ava', age_over_18: true },
      [docType]: { membership: 'gold' },
    })

    const presented = await present({
      id: randomUUID(),
      input_descriptors: [
        inputDescriptor(docType, [
          "$['org.iso.18013.5.1']['family_name']",
          "$['org.iso.18013.5.1']['age_over_18']",
          `$['${docType}']['membership']`,
        ]),
      ],
    })

    const expected = {
      'org.iso.18013.5.1': { family_name: 'Jones', age_over_18: true },
      [docType]: { membership: 'gold' },
    }
    expect(presented).toStrictEqual({ docType, nameSpaces: expected, disclosure: expected })
  })

  test('presents an optional data element the mdoc has, and passes without one it lacks', async () => {
    const docType = `org.example.${randomUUID()}`
    await storeMdoc(docType, { [docType]: { a: 'a', b: 'b' } })

    const presented = await present({
      id: randomUUID(),
      input_descriptors: [
        inputDescriptor(docType, [`$['${docType}']['a']`], [`$['${docType}']['b']`, `$['${docType}']['missing']`]),
      ],
    })

    expect(presented.nameSpaces).toStrictEqual({ [docType]: { a: 'a', b: 'b' } })
  })

  test('requests the path that resolved of a field with several paths', async () => {
    const docType = `org.example.${randomUUID()}`
    await storeMdoc(docType, { [docType]: { a: 'a', b: 'b' } })

    const presented = await present({
      id: randomUUID(),
      input_descriptors: [
        {
          ...inputDescriptor(docType, []),
          constraints: {
            limit_disclosure: 'required',
            fields: [{ path: [`$['${docType}']['missing']`, `$['${docType}']['b']`], intent_to_retain: false }],
          },
        },
      ],
    })

    expect(presented.nameSpaces).toStrictEqual({ [docType]: { b: 'b' } })
    expect(presented.disclosure).toStrictEqual({ [docType]: { b: 'b' } })
  })

  test('rejects a definition with a path into an mdoc data element', async () => {
    const docType = `org.example.${randomUUID()}`

    // ISO 18013-7 requests whole data elements
    await expect(
      pexService.getCredentialsForRequest(agent.context, {
        id: randomUUID(),
        input_descriptors: [inputDescriptor(docType, [`$['${docType}']['privileges'][0]['code']`])],
      })
    ).rejects.toThrow('Invalid presentation definition')
  })

  test('returns a query result for an input descriptor that requests no data element of the mdoc', async () => {
    const docType = `org.example.${randomUUID()}`
    await storeMdoc(docType, { [docType]: { a: 'a' } })

    for (const fields of [undefined, [{ path: [`$['${docType}']['missing']`], optional: true }]]) {
      const definition: DifPresentationExchangeDefinitionV2 = {
        id: randomUUID(),
        input_descriptors: [{ ...inputDescriptor(docType, []), constraints: { limit_disclosure: 'required', fields } }],
      }

      const queryResult = await pexService.getCredentialsForRequest(agent.context, definition)
      expect(queryResult.can_be_satisfied).toBe(true)
      expect(queryResult.input_descriptors[0].matching_credentials[0].disclosure.output).toStrictEqual({})

      // There is nothing to present
      await expect(
        pexService.createPresentation(agent.context, {
          credentialsForInputDescriptor: pexService.selectCredentialsForRequest(queryResult),
          presentationDefinition: definition,
          presentationSubmissionLocation: DifPresentationExchangeSubmissionLocation.External,
          challenge: 'challenge',
          domain: 'https://verifier.example.com',
          mdocSessionTranscript,
        })
      ).rejects.toThrow('requests no data element of the mdoc')
    }
  })

  test("doesn't match an mdoc whose doctype is not the input descriptor id", async () => {
    const docType = `org.example.${randomUUID()}`
    await storeMdoc(docType, { [docType]: { a: 'a' } })

    const queryResult = await pexService.getCredentialsForRequest(agent.context, {
      id: randomUUID(),
      input_descriptors: [inputDescriptor(`${docType}.other`, [`$['${docType}']['a']`])],
    })

    expect(queryResult.can_be_satisfied).toBe(false)
  })
})
