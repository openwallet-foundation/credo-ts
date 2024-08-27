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

    const hex =
      'a26a6e616d65537061636573a17765752e6575726f70612e65632e657564692e7069642e3196d818584fa4686469676573744944006672616e646f6d500eea3433f2eecdc89c68e182582bac2f71656c656d656e744964656e7469666965726b6167655f6f7665725f32316c656c656d656e7456616c7565f5d8185855a4686469676573744944016672616e646f6d507e626d175706017c0089ab49503fa1a871656c656d656e744964656e7469666965726f69737375696e675f636f756e7472796c656c656d656e7456616c7565624445d818586ba4686469676573744944026672616e646f6d505683c897e97f3de44c524936bbd0c94f71656c656d656e744964656e7469666965726d69737375616e63655f646174656c656c656d656e7456616c7565c07818323032342d30382d32365431353a31383a32382e3638315ad8185856a4686469676573744944036672616e646f6d50d17599eeafd17ed2a2e893956533366b71656c656d656e744964656e7469666965726d7265736964656e745f636974796c656c656d656e7456616c7565654bc3964c4ed818584fa4686469676573744944046672616e646f6d50de1f27f9d621858616b0fec5547c1a3171656c656d656e744964656e7469666965726b6167655f6f7665725f31326c656c656d656e7456616c7565f5d8185857a4686469676573744944056672616e646f6d5031ee7f2aebbf34701c6e220a64c8d9d871656c656d656e744964656e7469666965727169737375696e675f617574686f726974796c656c656d656e7456616c7565624445d818584fa4686469676573744944066672616e646f6d5038e404a7446652a7337ce3b8000f729971656c656d656e744964656e7469666965726b6167655f6f7665725f31386c656c656d656e7456616c7565f5d8185858a4686469676573744944076672616e646f6d505ea5bbbd925a2786af189bf9629cdbdc71656c656d656e744964656e7469666965726a62697274685f646174656c656c656d656e7456616c75656a313938342d30312d3236d8185855a4686469676573744944086672616e646f6d50d5aa8e0b730b4188d6ab1ed008d93dbc71656c656d656e744964656e7469666965726b62697274685f706c6163656c656c656d656e7456616c7565664245524c494ed8185869a4686469676573744944096672616e646f6d50da6e5d5e82bdc423e45bf1e0ec41b83971656c656d656e744964656e7469666965726b6578706972795f646174656c656c656d656e7456616c7565c07818323032342d30392d30395431353a31383a32382e3638315ad8185862a46864696765737449440a6672616e646f6d5022c2522e4e56aeb7e0ce66ef83a0170371656c656d656e744964656e7469666965726f7265736964656e745f7374726565746c656c656d656e7456616c75656f484549444553545241535345203137d8185851a46864696765737449440b6672616e646f6d50e22e078dca9c2344a5e5556a77af1d9c71656c656d656e744964656e7469666965726c6167655f696e5f79656172736c656c656d656e7456616c75651828d818584fa46864696765737449440c6672616e646f6d50b122fbd8a44c0ea4601fe9f1592401dc71656c656d656e744964656e7469666965726b6167655f6f7665725f31366c656c656d656e7456616c7565f5d8185853a46864696765737449440d6672616e646f6d50ccac1792abfaf00e2780515efbdf7af071656c656d656e744964656e7469666965726a676976656e5f6e616d656c656c656d656e7456616c7565654552494b41d818585da46864696765737449440e6672616e646f6d50b169dda4e26a95aae945cc784b98a09871656c656d656e744964656e746966696572747265736964656e745f706f7374616c5f636f64656c656c656d656e7456616c7565653531313437d8185854a46864696765737449440f6672616e646f6d504dc8106172bfa326a8178c2a2433d94d71656c656d656e744964656e7469666965726e6167655f62697274685f796561726c656c656d656e7456616c75651907c0d818586ca4686469676573744944106672616e646f6d50e1f88affb88567deecd22e931c1e941571656c656d656e744964656e7469666965726b6e6174696f6e616c6974796c656c656d656e7456616c7565a26576616c75656244456b636f756e7472794e616d65674765726d616e79d8185856a4686469676573744944116672616e646f6d50040e9f05dac519b8e61dfba8d49e864671656c656d656e744964656e746966696572707265736964656e745f636f756e7472796c656c656d656e7456616c7565624445d818585ba4686469676573744944126672616e646f6d506b5a38870f79286a6a3913e1be3a56e371656c656d656e744964656e7469666965727166616d696c795f6e616d655f62697274686c656c656d656e7456616c7565664741424c4552d818584fa4686469676573744944136672616e646f6d50fcb2427e61393b80df302a52f6678d0b71656c656d656e744964656e7469666965726b6167655f6f7665725f31346c656c656d656e7456616c7565f5d818584fa4686469676573744944146672616e646f6d50a3850a538d3c38fb89a0d794d3f0bfdd71656c656d656e744964656e7469666965726b6167655f6f7665725f36356c656c656d656e7456616c7565f4d8185859a4686469676573744944156672616e646f6d506d998293d74c96f6bcb0d0b21ea4c2a971656c656d656e744964656e7469666965726b66616d696c795f6e616d656c656c656d656e7456616c75656a4d55535445524d414e4e6a697373756572417574688443a10126a1182182590278308202743082021ba003020102020102300a06082a8648ce3d040302308188310b3009060355040613024445310f300d06035504070c064265726c696e311d301b060355040a0c1442756e646573647275636b6572656920476d62483111300f060355040b0c0854204353204944453136303406035504030c2d535052494e442046756e6b6520455544492057616c6c65742050726f746f747970652049737375696e67204341301e170d3234303533313038313331375a170d3235303730353038313331375a306c310b3009060355040613024445311d301b060355040a0c1442756e646573647275636b6572656920476d6248310a3008060355040b0c01493132303006035504030c29535052494e442046756e6b6520455544492057616c6c65742050726f746f74797065204973737565723059301306072a8648ce3d020106082a8648ce3d0301070342000438506ae1830a838c397d389fb32b7006e25fffb13b56144f5e2366e764b7ab511322005d5f20cade45711b181e1cf8af2cfdeeb8cbd2ea20c473ba8cc66bddb8a3819030818d301d0603551d0e0416041488f84290b12b0d73cb5b6fc9d1655e821cb0fa62300c0603551d130101ff04023000300e0603551d0f0101ff040403020780302d0603551d1104263024822264656d6f2e7069642d6973737565722e62756e646573647275636b657265692e6465301f0603551d23041830168014d45618c08938e80e588418c97662bfabbbc590be300a06082a8648ce3d040302034700304402201b7f94f391c43385f5a8228ca2d5537b77c23d06c14a9b531696e4698766f219022029891dacd7f6c573e35526e35bf53fe52e6f0040b95f170e6a7bac381ae805b559027d3082027930820220a003020102021407913d41566d99461c0ed0a3281fc7dd542fef68300a06082a8648ce3d040302308188310b3009060355040613024445310f300d06035504070c064265726c696e311d301b060355040a0c1442756e646573647275636b6572656920476d62483111300f060355040b0c0854204353204944453136303406035504030c2d535052494e442046756e6b6520455544492057616c6c65742050726f746f747970652049737375696e67204341301e170d3234303533313036343830395a170d3334303532393036343830395a308188310b3009060355040613024445310f300d06035504070c064265726c696e311d301b060355040a0c1442756e646573647275636b6572656920476d62483111300f060355040b0c0854204353204944453136303406035504030c2d535052494e442046756e6b6520455544492057616c6c65742050726f746f747970652049737375696e672043413059301306072a8648ce3d020106082a8648ce3d03010703420004606cddc050e773bf8a9f989b02f08e33c91eefb550c6a7cc73064bf0868803e58244e7027e663f8221fddaa32bbb9a7f9323a2bc4d110bf21b74c38dbc3a14c9a3663064301d0603551d0e04160414d45618c08938e80e588418c97662bfabbbc590be301f0603551d23041830168014d45618c08938e80e588418c97662bfabbbc590be30120603551d130101ff040830060101ff020100300e0603551d0f0101ff040403020186300a06082a8648ce3d040302034700304402206126ef0919287b7f6ad6f831d1675d6eb2ae7c0c513daed77ea076d975d18ea102206e4c5aaf558b61d6b6f1cc23f4c566479902bd915cb19fc18f7d7dbb108cf3b3590443d81859043ea667646f63547970657765752e6575726f70612e65632e657564692e7069642e316776657273696f6e63312e306c76616c6964697479496e666fa3667369676e6564c074323032342d30382d32365431353a31383a32385a6976616c696446726f6dc074323032342d30382d32365431353a31383a32385a6a76616c6964556e74696cc074323032342d30392d30395431353a31383a32385a6c76616c756544696765737473a17765752e6575726f70612e65632e657564692e7069642e31b60058205f153ee7aecbb2e614ccf37a1a6ae3520073138d5edbb8b690849ad436d21d42015820581558435b8d6a81f926c104b82463687bc3b8665da71e9257748e874eb87715025820129bb3e09150aa7a6b5356c66cbf9282a11b3d9292b2f8fd450057ec6b2afc7b035820da675f05cc64b09fc4db4f47cf921d221455777578439160b65060dde143f2a804582059d97e4d35cdba44a72ad911be90d937209ca1acfcba377eec6fcf703bd07ff4055820c3099a8fed33a69a9f44a1b4bf27850b9811cc9b7af0a0d03ba883224c052c0d0658209a4f0f74474ff0f68d71378847bc781873751883700fb94a6812a83cbff4159e0758209bb17b74d941978a1f44706a15a304329ec5877695d336172aa99133c5acc998085820f66326ace77f430be9f2be3600e7a9bbec640d58abb7ca00547ee1620b838c6c095820ffbd2753ea1baa4d59dd84f714f914d38f867a75d46809c1e63c506a8ce1c42f0a58208cf25053a420e9db09dad025e995f9c4d6482b1a9dc36ec73ef22f792ca5f7e90b5820807520617d8e9fa2c2ea342f7fae8bccc3f584ddf57d1076a2e2323e45b0b43c0c58207416891a89b9d931136fe03237f257bd938201a8c7b8b1ab3eb029259057a0f00d582031b2637c669778dc12a732e1201c255a9a310856b6be869c99529bd4b4e240c20e5820d2e570514fccab380a7506be22587f60c746c10f35e3d76d0c595c600439a7470f5820e0d0ee1549d3daf83f8aa0c57a510673935a4768860c5f6ba0a4ba7104b081901058202d0ffadbae79cd2eda9dbec4cb666ed1378b0248d6258c8977cbf57539b0cc8f115820c79a6261f7b82262ff381b95283b67731c7c6251daf029689d4ab886aca952ef1258201be653472b61800053599e364d1a50a086e5ab34f2328c25b29ad4d8ed17513d135820e35971959449d58b686fe8025e64e49f6dc9b33c33c4a2b68eb31a575231715b1458206b53b00f7fe0bc9eac97e66f6a2d4cc4a1b0327aee1df433db820157b1c95718155820d6feca03b0469c690a5140d1ee268204d39e8485e289c4273cc55f9ce1d921946d6465766963654b6579496e666fa1696465766963654b6579a4010220012158204479c0bbc17c0f4fda07c94c619ea782aeb40430007022d0a8e9d522c52209ff2258206fe0afb90f2c94fd8d0fd3be71fd338373f0bd5dcee47a561b8b5ee4b106f50b6f646967657374416c676f726974686d675348412d3235365840a9a64639ce233688994bb8f04105abfd9488bd4fe838b32c4d33a2d0a4e983a9bbf78832d34cc15fc06b45329a5ae5bb86ceb3aecb15364886ea2bd7a855452d'

    const sprindFunkeX509TrustedCertificate =
      'MIICdDCCAhugAwIBAgIBAjAKBggqhkjOPQQDAjCBiDELMAkGA1UEBhMCREUxDzANBgNVBAcMBkJlcmxpbjEdMBsGA1UECgwUQnVuZGVzZHJ1Y2tlcmVpIEdtYkgxETAPBgNVBAsMCFQgQ1MgSURFMTYwNAYDVQQDDC1TUFJJTkQgRnVua2UgRVVESSBXYWxsZXQgUHJvdG90eXBlIElzc3VpbmcgQ0EwHhcNMjQwNTMxMDgxMzE3WhcNMjUwNzA1MDgxMzE3WjBsMQswCQYDVQQGEwJERTEdMBsGA1UECgwUQnVuZGVzZHJ1Y2tlcmVpIEdtYkgxCjAIBgNVBAsMAUkxMjAwBgNVBAMMKVNQUklORCBGdW5rZSBFVURJIFdhbGxldCBQcm90b3R5cGUgSXNzdWVyMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEOFBq4YMKg4w5fTifsytwBuJf/7E7VhRPXiNm52S3q1ETIgBdXyDK3kVxGxgeHPivLP3uuMvS6iDEc7qMxmvduKOBkDCBjTAdBgNVHQ4EFgQUiPhCkLErDXPLW2/J0WVeghyw+mIwDAYDVR0TAQH/BAIwADAOBgNVHQ8BAf8EBAMCB4AwLQYDVR0RBCYwJIIiZGVtby5waWQtaXNzdWVyLmJ1bmRlc2RydWNrZXJlaS5kZTAfBgNVHSMEGDAWgBTUVhjAiTjoDliEGMl2Yr+ru8WQvjAKBggqhkjOPQQDAgNHADBEAiAbf5TzkcQzhfWoIoyi1VN7d8I9BsFKm1MWluRph2byGQIgKYkdrNf2xXPjVSbjW/U/5S5vAEC5XxcOanusOBroBbU='

    await verifier.agent.x509.addTrustedCertificate(sprindFunkeX509TrustedCertificate)

    const mdoc = Mdoc.fromIssuerSignedHex(hex)
    await holder.agent.mdoc.store(mdoc)

    const resolvedAuthorizationRequest = await holder.agent.modules.openId4VcHolder.resolveSiopAuthorizationRequest(
      authorizationRequest
    )

    const presentationExchangeService = holder.agent.dependencyManager.resolve(DifPresentationExchangeService)
    if (!resolvedAuthorizationRequest.presentationExchange) throw new Error('Missing PresentationExchange')

    const selectedCredentials = presentationExchangeService.selectCredentialsForRequest(
      resolvedAuthorizationRequest.presentationExchange.credentialsForRequest
    )

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
