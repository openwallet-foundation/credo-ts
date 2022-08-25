import { JsonTransformer } from '../../../utils/JsonTransformer'
import { FeatureRegistry } from '../FeatureRegistry'
import { Protocol } from '../models'
import { GoalCode } from '../models/GoalCode'

describe('Feature Registry', () => {
  test('register generic feature', () => {
    const featureRegistry = new FeatureRegistry()

    const goalCode = new GoalCode({ id: 'aries.vc.issue' })

    expect(JsonTransformer.toJSON(goalCode)).toMatchObject({ id: 'aries.vc.issue', 'feature-type': 'goal-code' })

    featureRegistry.register(goalCode)
    const found = featureRegistry.query({ featureType: GoalCode.type, match: 'aries.*' })

    expect(found.map((t) => t.toJSON())).toStrictEqual([{ id: 'aries.vc.issue', 'feature-type': 'goal-code' }])
  })

  test('register combined features', () => {
    const featureRegistry = new FeatureRegistry()

    featureRegistry.register(
      new Protocol({ id: 'https://didcomm.org/dummy/1.0', roles: ['requester'] }),
      new Protocol({ id: 'https://didcomm.org/dummy/1.0', roles: ['responder'] }),
      new Protocol({ id: 'https://didcomm.org/dummy/1.0', roles: ['responder'] })
    )
    const found = featureRegistry.query({ featureType: Protocol.type, match: 'https://didcomm.org/dummy/1.0' })

    expect(found.map((t) => t.toJSON())).toStrictEqual([
      { id: 'https://didcomm.org/dummy/1.0', 'feature-type': 'protocol', roles: ['requester', 'responder'] },
    ])
  })
})
