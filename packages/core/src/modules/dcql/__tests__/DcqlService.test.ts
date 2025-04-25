import { SdJwtVc } from '../../sd-jwt-vc'
import { ClaimFormat } from '../../vc'
import { DcqlError } from '../DcqlError'
import { DcqlService } from '../DcqlService'

const dcqlService = new DcqlService()

describe('DcqlService', () => {
  test('assertValidPresentation', () => {
    expect(() =>
      dcqlService.assertValidDcqlPresentation(
        {
          something: {
            claimFormat: ClaimFormat.SdJwtVc,
            prettyClaims: {
              vct: 'something',
              age_over_21: true,
            },
          } satisfies Partial<SdJwtVc> as unknown as SdJwtVc,
        },
        {
          credentials: [
            {
              format: 'dc+sd-jwt',
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
    ).toThrow(
      new DcqlError('Presentations do not satisfy the DCQL query.', {
        additionalMessages: [
          `query 'something' does not match. {
  "claims.age_over_18": [
    "Invalid type: Expected (!null & !undefined) but received undefined"
  ]
}`,
        ],
      })
    )
  })
})
