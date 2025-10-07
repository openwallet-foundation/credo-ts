import { AgentContext } from '../../../agent'
import { type SdJwtVc } from '../../sd-jwt-vc'
import { ClaimFormat } from '../../vc'
import { DcqlError } from '../DcqlError'
import { DcqlService } from '../DcqlService'

const dcqlService = new DcqlService()

describe('DcqlService', () => {
  test('assertValidPresentation', async () => {
    await expect(
      dcqlService.assertValidDcqlPresentation(
        {} as AgentContext,
        {
          something: [
            {
              claimFormat: ClaimFormat.SdJwtDc,
              prettyClaims: {
                vct: 'something',
                age_over_21: true,
              },
            } satisfies Partial<SdJwtVc> as unknown as SdJwtVc,
          ],
        },
        {
          credentials: [
            {
              format: 'dc+sd-jwt',
              multiple: false,
              require_cryptographic_holder_binding: true,
              id: 'something',
              claims: [
                {
                  path: ['age_over_18'],
                },
              ],
              meta: {
                vct_values: ['something'],
              },
            },
          ],
        }
      )
    ).rejects.toThrow(
      new DcqlError('Presentations do not satisfy the DCQL query.', {
        additionalMessages: [
          `Presentation at index 0 does not match query credential 'something'. {
  "claims": [
    {
      "age_over_18": [
        "Expected claim 'age_over_18' to be defined"
      ]
    }
  ]
}`,
        ],
      })
    )
  })
})
