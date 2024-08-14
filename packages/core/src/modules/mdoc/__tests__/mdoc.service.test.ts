import { Agent } from '../../..'
import { getInMemoryAgentOptions } from '../../../../tests'
import { Mdoc } from '../Mdoc'

import { sprindFunkeX509TrustedCertificate, sprindFunkeTestVectorBase64Url } from './mdoc.fixtures'

const agent = new Agent(getInMemoryAgentOptions('mdoc-test-agent', {}))

describe('mdoc service test', () => {
  test('can get issuer-auth protected-header alg', async () => {
    const mdoc = Mdoc.fromIssuerSignedBase64(sprindFunkeTestVectorBase64Url)
    expect(mdoc.jwaSignatureAlgorithm).toBe('ES256')
  })

  test('can decode claims from namespaces', async () => {
    const mdoc = Mdoc.fromIssuerSignedBase64(sprindFunkeTestVectorBase64Url)
    const namespaces = mdoc.namespaces
    expect(Object.entries(namespaces)).toHaveLength(1)

    expect(namespaces).toBeDefined()
    const eudiPidNamespace = namespaces['eu.europa.ec.eudi.pid.1']
    expect(eudiPidNamespace).toBeDefined()
    // TODO: ADD checks once sphereno fixed the namespace structure
    //expect(Object.keys(eudiPidNamespace)).toHaveLength(22)
    //expect(eudiPidNamespace['family_name']).toEqual('MUSTERMANN')
  })

  test('can verify sprindFunkeTestVector Issuer Signed structure', async () => {
    const mdoc = Mdoc.fromIssuerSignedBase64(sprindFunkeTestVectorBase64Url)
    //const decoded = decode(TypedArrayEncoder.fromBase64(sprindFunkeTestVectorBase64Url))
    //const tryit = decoded.issuerAuth[2]
    //const decodeAgain = decode(tryit)
    //const decodeAgain2 = decode(decodeAgain.value)
    const verify = await mdoc.verify(agent.context, {
      trustedCertificates: [sprindFunkeX509TrustedCertificate],
    })
    expect(verify.isValid).toBeTruthy()
  })
})
