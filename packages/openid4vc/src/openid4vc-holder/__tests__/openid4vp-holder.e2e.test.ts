import type { AgentType } from '../../../tests/utils'
import type { OpenId4VcVerifierRecord } from '../../openid4vc-verifier/repository'
import type { DifPresentationExchangeDefinitionV2 } from '@credo-ts/core'
import type { Express } from 'express'
import type { Server } from 'http'

import { DifPresentationExchangeService, Mdoc } from '@credo-ts/core'
import { MdocVerifiablePresentation } from '@sphereon/did-auth-siop'
import express from 'express'

import { AskarModule } from '../../../../askar/src'
import { askarModuleConfig } from '../../../../askar/tests/helpers'
import { waitForVerificationSessionRecordSubject, createAgentFromModules } from '../../../tests/utils'
import { OpenId4VcVerificationSessionState, OpenId4VcVerifierModule } from '../../openid4vc-verifier'
import { OpenId4VcHolderModule } from '../OpenId4VcHolderModule'

import { funke_sprind_mdoc_presentation_definition } from './fixtures'

const port = 3121
const verifierBaseUrl = `http://localhost:${port}`

const holderModules = {
  openId4VcHolder: new OpenId4VcHolderModule(),
  askar: new AskarModule(askarModuleConfig),
}

const verifierModules = {
  openId4VcVerifier: new OpenId4VcVerifierModule({
    baseUrl: verifierBaseUrl,
  }),
  askar: new AskarModule(askarModuleConfig),
}

describe('OpenId4VcHolder | OpenID4VP', () => {
  let openIdVerifier: OpenId4VcVerifierRecord
  let verifier: AgentType<typeof verifierModules>
  let holder: AgentType<typeof holderModules>
  let verifierApp: Express

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let verifierServer: Server<any, any>

  beforeEach(async () => {
    verifier = await createAgentFromModules('verifier', verifierModules, '96213c3d7fc8d4d6754c7a0fd969598f')
    openIdVerifier = await verifier.agent.modules.openId4VcVerifier.createVerifier()
    holder = await createAgentFromModules('holder', holderModules, '96213c3d7fc8d4d6754c7a0fd969598e')
    verifierApp = express()

    verifierApp.use('/', verifier.agent.modules.openId4VcVerifier.config.router)
    verifierServer = verifierApp.listen(port)
  })

  afterEach(async () => {
    verifierServer?.close()
    await holder.agent.shutdown()
    await holder.agent.wallet.delete()
    await verifier.agent.shutdown()
    await verifier.agent.wallet.delete()
  })

  it('siop authorization request without presentation exchange', async () => {
    const { authorizationRequest, verificationSession } =
      await verifier.agent.modules.openId4VcVerifier.createAuthorizationRequest({
        requestSigner: {
          method: 'did',
          didUrl: verifier.kid,
        },
        verifierId: openIdVerifier.verifierId,
      })

    const resolvedAuthorizationRequest = await holder.agent.modules.openId4VcHolder.resolveSiopAuthorizationRequest(
      authorizationRequest
    )

    const { submittedResponse, serverResponse } =
      await holder.agent.modules.openId4VcHolder.acceptSiopAuthorizationRequest({
        authorizationRequest: resolvedAuthorizationRequest.authorizationRequest,
        // When no VP is created, we need to provide the did we want to use for authentication
        openIdTokenIssuer: {
          method: 'did',
          didUrl: holder.kid,
        },
      })

    expect(serverResponse).toEqual({
      status: 200,
      body: '',
    })

    expect(submittedResponse).toMatchObject({
      expires_in: 6000,
      id_token: expect.any(String),
      state: expect.any(String),
    })

    await waitForVerificationSessionRecordSubject(verifier.replaySubject, {
      state: OpenId4VcVerificationSessionState.ResponseVerified,
      contextCorrelationId: verifier.agent.context.contextCorrelationId,
      verificationSessionId: verificationSession.id,
    })

    const { idToken, presentationExchange } =
      await verifier.agent.modules.openId4VcVerifier.getVerifiedAuthorizationResponse(verificationSession.id)

    expect(presentationExchange).toBeUndefined()
    expect(idToken).toMatchObject({
      payload: {
        state: expect.any(String),
        nonce: expect.any(String),
      },
    })
  })

  it('mdoc presentation definition request', async () => {
    const { authorizationRequest, verificationSession } =
      await verifier.agent.modules.openId4VcVerifier.createAuthorizationRequest({
        requestSigner: {
          method: 'did',
          didUrl: verifier.kid,
        },
        verifierId: openIdVerifier.verifierId,
        presentationExchange: {
          definition: funke_sprind_mdoc_presentation_definition as DifPresentationExchangeDefinitionV2,
        },
      })

    const sprindFunkeTestVectorBase64Url =
      'omppc3N1ZXJBdXRohEOhASahGCGCWQJ4MIICdDCCAhugAwIBAgIBAjAKBggqhkjOPQQDAjCBiDELMAkGA1UEBhMCREUxDzANBgNVBAcMBkJlcmxpbjEdMBsGA1UECgwUQnVuZGVzZHJ1Y2tlcmVpIEdtYkgxETAPBgNVBAsMCFQgQ1MgSURFMTYwNAYDVQQDDC1TUFJJTkQgRnVua2UgRVVESSBXYWxsZXQgUHJvdG90eXBlIElzc3VpbmcgQ0EwHhcNMjQwNTMxMDgxMzE3WhcNMjUwNzA1MDgxMzE3WjBsMQswCQYDVQQGEwJERTEdMBsGA1UECgwUQnVuZGVzZHJ1Y2tlcmVpIEdtYkgxCjAIBgNVBAsMAUkxMjAwBgNVBAMMKVNQUklORCBGdW5rZSBFVURJIFdhbGxldCBQcm90b3R5cGUgSXNzdWVyMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEOFBq4YMKg4w5fTifsytwBuJf_7E7VhRPXiNm52S3q1ETIgBdXyDK3kVxGxgeHPivLP3uuMvS6iDEc7qMxmvduKOBkDCBjTAdBgNVHQ4EFgQUiPhCkLErDXPLW2_J0WVeghyw-mIwDAYDVR0TAQH_BAIwADAOBgNVHQ8BAf8EBAMCB4AwLQYDVR0RBCYwJIIiZGVtby5waWQtaXNzdWVyLmJ1bmRlc2RydWNrZXJlaS5kZTAfBgNVHSMEGDAWgBTUVhjAiTjoDliEGMl2Yr-ru8WQvjAKBggqhkjOPQQDAgNHADBEAiAbf5TzkcQzhfWoIoyi1VN7d8I9BsFKm1MWluRph2byGQIgKYkdrNf2xXPjVSbjW_U_5S5vAEC5XxcOanusOBroBbVZAn0wggJ5MIICIKADAgECAhQHkT1BVm2ZRhwO0KMoH8fdVC_vaDAKBggqhkjOPQQDAjCBiDELMAkGA1UEBhMCREUxDzANBgNVBAcMBkJlcmxpbjEdMBsGA1UECgwUQnVuZGVzZHJ1Y2tlcmVpIEdtYkgxETAPBgNVBAsMCFQgQ1MgSURFMTYwNAYDVQQDDC1TUFJJTkQgRnVua2UgRVVESSBXYWxsZXQgUHJvdG90eXBlIElzc3VpbmcgQ0EwHhcNMjQwNTMxMDY0ODA5WhcNMzQwNTI5MDY0ODA5WjCBiDELMAkGA1UEBhMCREUxDzANBgNVBAcMBkJlcmxpbjEdMBsGA1UECgwUQnVuZGVzZHJ1Y2tlcmVpIEdtYkgxETAPBgNVBAsMCFQgQ1MgSURFMTYwNAYDVQQDDC1TUFJJTkQgRnVua2UgRVVESSBXYWxsZXQgUHJvdG90eXBlIElzc3VpbmcgQ0EwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAARgbN3AUOdzv4qfmJsC8I4zyR7vtVDGp8xzBkvwhogD5YJE5wJ-Zj-CIf3aoyu7mn-TI6K8TREL8ht0w428OhTJo2YwZDAdBgNVHQ4EFgQU1FYYwIk46A5YhBjJdmK_q7vFkL4wHwYDVR0jBBgwFoAU1FYYwIk46A5YhBjJdmK_q7vFkL4wEgYDVR0TAQH_BAgwBgEB_wIBADAOBgNVHQ8BAf8EBAMCAYYwCgYIKoZIzj0EAwIDRwAwRAIgYSbvCRkoe39q1vgx0WddbrKufAxRPa7XfqB22XXRjqECIG5MWq9Vi2HWtvHMI_TFZkeZAr2RXLGfwY99fbsQjPOzWQRA2BhZBDumZ2RvY1R5cGV3ZXUuZXVyb3BhLmVjLmV1ZGkucGlkLjFndmVyc2lvbmMxLjBsdmFsaWRpdHlJbmZvo2ZzaWduZWR0MjAyNC0wNi0yNFQwNjo1MDo0MFppdmFsaWRGcm9tdDIwMjQtMDYtMjRUMDY6NTA6NDBaanZhbGlkVW50aWx0MjAyNC0wNy0wOFQwNjo1MDo0MFpsdmFsdWVEaWdlc3RzoXdldS5ldXJvcGEuZWMuZXVkaS5waWQuMbYAWCDJVfFwuYp2QoZROAvEN2pyUZ1KM8pEWRZXfdWrF1HkigFYIHhpl7kR5NAjeLSFJd0LsjMB9_ZeOBi-pYiOSwG78rrEAlggEih2FMRoq01sCrA8gZ-r_pUqi7add99aSg_l9iuV7w8DWCD9umaT-ULFoZSewraVNXFFWf3iNm5rgj75OQAy7n-1HQRYIL8xH7_OLXmsTruVMI1AInTjtDyPiDkk3ZaljsXFMaeYBVgg2-7WIwtpcZgVI3ZpKiFOqf8cV_R8G20adAqk3xLmaR8GWCCMFjcNb1Yp0rw86h1OOYCPzIhE-Dt5yWCQ7BTpNbZBuwdYIEzmGyjypgomuuwlwyp44zLi6sXT11ZNoyDAMKEsNP0pCFggI2ENhbCnOrZsVvqNE1GJe13ygY7MMU_Hv7l7j60Y5BgJWCBDZb6ztiG-09jmZNNc3Qi4e1OhyqtNmrOxzuzCtMYKcgpYIDGYllJw4PxQlyaeiI-a0qaeD9C3qh2hKXtvYYol928zC1gg4etokah75K55-qzJ6_FtE2KtAF9gy3gzcTeirdZ3LHwMWCDnCnqeX1M1iJe3LH2qc0kJOXQHYUEubpqVi2c4wtt3xQ1YIL7dVtgkdG9n2pDvrBtgY21i7X7YyiVCe-p61mtghwjnDlggQk4FkmKScm6oCwHtt5Og5E_1SQfuWpFIMdj0x8ZCS0wPWCBGMDXYqqBPDqeqBoFn3IKJSZWcdMj7KyU1ZtNOZ3OE6hBYIJyzjluOe_VlYSQw1aIBcrsnnF2czy5ypChycRfi0nrOEVggKOd_n9xKuZDdnak-vQ1zrIzSWLxJIlPgJMpLEn2FuLYSWCBHx1eoCb1ydVj_EGIKUOYPCyEjAgP5HxN-J_zSZUwkKBNYIN0hCZPdhjF4pU-LVEoQi7FdOSF3lrQ8EimA7C31NcVhFFggxtk6j0328cyjnwNoWKCUgvg1Uk37Bktpzb4atlRT5VIVWCAMujq43dRJg7XilJJL0z-hxQoLUpkzO2tq6H6LazG0uW1kZXZpY2VLZXlJbmZvoWlkZXZpY2VLZXmkAQIgASFYIMrI7GWNvKwCXqwcJmkBMyIRAXejiET9PRAFCMhJEfo9IlggEvXLy65sT8QyzLnWsC7aIM1eem2029awDcWI7WO0ES9vZGlnZXN0QWxnb3JpdGhtZ1NIQS0yNTZYQLVKBk4WMWUjTFWSwUuz7vCPNCAqw5x7HIBHVr1H_gC5WOEXxBaFlnxHYBjBguFSfLe5e-7t82ySdef7uvo6d2NqbmFtZVNwYWNlc6F3ZXUuZXVyb3BhLmVjLmV1ZGkucGlkLjGW2BhYVqRmcmFuZG9tUPYpQ7wOENpcyi6n1L56UdhoZGlnZXN0SUQAbGVsZW1lbnRWYWx1ZWJERXFlbGVtZW50SWRlbnRpZmllcnByZXNpZGVudF9jb3VudHJ52BhYT6RmcmFuZG9tUMRgxk_vnHlF0GwDT1_ULxJoZGlnZXN0SUQBbGVsZW1lbnRWYWx1ZfVxZWxlbWVudElkZW50aWZpZXJrYWdlX292ZXJfMTLYGFhbpGZyYW5kb21QKjeWt5G4r5-qtZytkvPCY2hkaWdlc3RJRAJsZWxlbWVudFZhbHVlZkdBQkxFUnFlbGVtZW50SWRlbnRpZmllcnFmYW1pbHlfbmFtZV9iaXJ0aNgYWFOkZnJhbmRvbVBDbqFvUf9mgbrDQOa3wxwcaGRpZ2VzdElEA2xlbGVtZW50VmFsdWVlRVJJS0FxZWxlbWVudElkZW50aWZpZXJqZ2l2ZW5fbmFtZdgYWFSkZnJhbmRvbVC0poiPe3Qx58JWmtP7Q_WGaGRpZ2VzdElEBGxlbGVtZW50VmFsdWUZB6xxZWxlbWVudElkZW50aWZpZXJuYWdlX2JpcnRoX3llYXLYGFhPpGZyYW5kb21Qu7cn53_6IG1TiAz9anV2VGhkaWdlc3RJRAVsZWxlbWVudFZhbHVl9XFlbGVtZW50SWRlbnRpZmllcmthZ2Vfb3Zlcl8xONgYWE-kZnJhbmRvbVCRPYwpMh16--3IgrBqvPiHaGRpZ2VzdElEBmxlbGVtZW50VmFsdWX1cWVsZW1lbnRJZGVudGlmaWVya2FnZV9vdmVyXzIx2BhYVqRmcmFuZG9tUGu5N18O3ztKBJRIqXuXprFoZGlnZXN0SUQHbGVsZW1lbnRWYWx1ZWVLw5ZMTnFlbGVtZW50SWRlbnRpZmllcm1yZXNpZGVudF9jaXR52BhYbKRmcmFuZG9tUDKXb5L9OGRMoOqY4ixLrj5oZGlnZXN0SUQIbGVsZW1lbnRWYWx1ZaJldmFsdWViREVrY291bnRyeU5hbWVnR2VybWFueXFlbGVtZW50SWRlbnRpZmllcmtuYXRpb25hbGl0edgYWFmkZnJhbmRvbVD4nB3KeJEBfi7oTQaUgKmcaGRpZ2VzdElECWxlbGVtZW50VmFsdWVqTVVTVEVSTUFOTnFlbGVtZW50SWRlbnRpZmllcmtmYW1pbHlfbmFtZdgYWFWkZnJhbmRvbVDzJdpDC6MZvIaVDJ_psS7JaGRpZ2VzdElECmxlbGVtZW50VmFsdWVmQkVSTElOcWVsZW1lbnRJZGVudGlmaWVya2JpcnRoX3BsYWNl2BhYVaRmcmFuZG9tUKEIada4bfyv5GeAbFb3reZoZGlnZXN0SUQLbGVsZW1lbnRWYWx1ZWJERXFlbGVtZW50SWRlbnRpZmllcm9pc3N1aW5nX2NvdW50cnnYGFhPpGZyYW5kb21Qqbo3TPNv6ilm7tvlR4l_GGhkaWdlc3RJRAxsZWxlbWVudFZhbHVl9HFlbGVtZW50SWRlbnRpZmllcmthZ2Vfb3Zlcl82NdgYWGykZnJhbmRvbVC_nvMTClyTddZfwm_WviXAaGRpZ2VzdElEDWxlbGVtZW50VmFsdWWiZG5hbm8aNQgmzGtlcG9jaFNlY29uZBpmeRdAcWVsZW1lbnRJZGVudGlmaWVybWlzc3VhbmNlX2RhdGXYGFhqpGZyYW5kb21QPqCKymVJhGPADlN7tILk2mhkaWdlc3RJRA5sZWxlbWVudFZhbHVlomRuYW5vGjUIJsxrZXBvY2hTZWNvbmQaZouMQHFlbGVtZW50SWRlbnRpZmllcmtleHBpcnlfZGF0ZdgYWGOkZnJhbmRvbVC0Cd-E5IjcJYTHKNzujqXlaGRpZ2VzdElED2xlbGVtZW50VmFsdWVwSEVJREVTVFJB4bqeRSAxN3FlbGVtZW50SWRlbnRpZmllcm9yZXNpZGVudF9zdHJlZXTYGFhPpGZyYW5kb21QBSfulxP_wSm8WUJ31jD9U2hkaWdlc3RJRBBsZWxlbWVudFZhbHVl9XFlbGVtZW50SWRlbnRpZmllcmthZ2Vfb3Zlcl8xNtgYWF2kZnJhbmRvbVDAyvF8NuW7ZU4yWPFlZEQ9aGRpZ2VzdElEEWxlbGVtZW50VmFsdWVlNTExNDdxZWxlbWVudElkZW50aWZpZXJ0cmVzaWRlbnRfcG9zdGFsX2NvZGXYGFhYpGZyYW5kb21QH_0ki1hqwWblAMFbrwMO2GhkaWdlc3RJRBJsZWxlbWVudFZhbHVlajE5NjQtMDgtMTJxZWxlbWVudElkZW50aWZpZXJqYmlydGhfZGF0ZdgYWFekZnJhbmRvbVBaUAbNICOqTrrbEaDKqbtSaGRpZ2VzdElEE2xlbGVtZW50VmFsdWViREVxZWxlbWVudElkZW50aWZpZXJxaXNzdWluZ19hdXRob3JpdHnYGFhPpGZyYW5kb21QtyDyyKiExuZFhmsIS1M122hkaWdlc3RJRBRsZWxlbWVudFZhbHVl9XFlbGVtZW50SWRlbnRpZmllcmthZ2Vfb3Zlcl8xNNgYWFGkZnJhbmRvbVAIbRM0JOd2WfpsMlmrMWMaaGRpZ2VzdElEFWxlbGVtZW50VmFsdWUYO3FlbGVtZW50SWRlbnRpZmllcmxhZ2VfaW5feWVhcnM'

    const mdoc = Mdoc.fromIssuerSignedBase64(sprindFunkeTestVectorBase64Url)
    await holder.agent.mdoc.store(mdoc)

    const resolvedAuthorizationRequest = await holder.agent.modules.openId4VcHolder.resolveSiopAuthorizationRequest(
      authorizationRequest
    )

    const presentationExchangeService = holder.agent.dependencyManager.resolve(DifPresentationExchangeService)
    if (!resolvedAuthorizationRequest.presentationExchange) throw new Error('Missing PresentationExchange')

    const selectedCredentials = presentationExchangeService.selectCredentialsForRequest(
      resolvedAuthorizationRequest.presentationExchange.credentialsForRequest
    )

    // create the response our

    const { submittedResponse, serverResponse } =
      await holder.agent.modules.openId4VcHolder.acceptSiopAuthorizationRequest({
        authorizationRequest: resolvedAuthorizationRequest.authorizationRequest,
        // When no VP is created, we need to provide the did we want to use for authentication
        openIdTokenIssuer: {
          method: 'did',
          didUrl: holder.kid,
        },
        presentationExchange: {
          credentials: selectedCredentials,
        },
      })

    expect(serverResponse).toEqual({
      status: 200,
      body: '',
    })

    const expectedSubmission = {
      id: 'mdoc-presentation-submission',
      // definition_id: 'mDL-sample-req', // TODO: THIS SHOULD ALSO BE INCLUDED
      descriptor_map: [
        {
          id: 'eu.europa.ec.eudi.pid.1',
          format: 'mso_mdoc',
          path: '$',
        },
      ],
    }

    expect(submittedResponse).toMatchObject({
      vp_token: expect.any(String),
      expires_in: 6000,
      state: expect.any(String),
    })

    await waitForVerificationSessionRecordSubject(verifier.replaySubject, {
      state: OpenId4VcVerificationSessionState.ResponseVerified,
      contextCorrelationId: verifier.agent.context.contextCorrelationId,
      verificationSessionId: verificationSession.id,
    })

    const { idToken, presentationExchange } =
      await verifier.agent.modules.openId4VcVerifier.getVerifiedAuthorizationResponse(verificationSession.id)

    expect(idToken).toBeUndefined()
    expect(presentationExchange).toBeDefined()
    expect(presentationExchange?.submission).toMatchObject(expectedSubmission)
    expect(presentationExchange?.definition).toMatchObject(funke_sprind_mdoc_presentation_definition)
    expect(presentationExchange?.presentations).toHaveLength(1)
    expect(presentationExchange?.presentations[0]).toBeInstanceOf(MdocVerifiablePresentation)

    const mdocVerifiablePresentation = presentationExchange?.presentations[0]
    if (!mdocVerifiablePresentation || mdocVerifiablePresentation instanceof MdocVerifiablePresentation === false) {
      throw new Error('presentationExchange?.presentations[0] is undefined')
    }

    const deviceSigned = JSON.parse(mdocVerifiablePresentation.deviceSignedBase64Url).deviceSigned
    const disclosedClaims = await Mdoc.getDisclosedClaims(deviceSigned)

    expect(disclosedClaims).toStrictEqual({
      'eu.europa.ec.eudi.pid.1': {
        age_over_21: true,
        family_name: 'MUSTERMANN',
        given_name: 'ERIKA',
        nationality: undefined,
      },
    })
  })
})
