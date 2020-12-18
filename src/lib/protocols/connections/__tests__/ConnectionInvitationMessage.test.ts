import { validateOrReject } from 'class-validator';

import { ConnectionInvitationMessage } from '../ConnectionInvitationMessage';
import { JsonTransformer } from '../../../utils/JsonTransformer';

describe('ConnectionInvitationMessage', () => {
  it('should allow routingKeys to be left out of inline invitation', async () => {
    const json = {
      '@type': ConnectionInvitationMessage.type,
      '@id': '04a2c382-999e-4de9-a1d2-9dec0b2fa5e4',
      recipientKeys: ['recipientKeyOne', 'recipientKeyTwo'],
      serviceEndpoint: 'https://example.com',
      label: 'test',
    };
    const invitation = JsonTransformer.fromJSON(json, ConnectionInvitationMessage);
    await expect(validateOrReject(invitation)).resolves.toBeUndefined();
  });

  it('should throw error if both did and inline keys / endpoint are missing', async () => {
    const json = {
      '@type': ConnectionInvitationMessage.type,
      '@id': '04a2c382-999e-4de9-a1d2-9dec0b2fa5e4',
      label: 'test',
    };
    const invitation = JsonTransformer.fromJSON(json, ConnectionInvitationMessage);
    await expect(validateOrReject(invitation)).rejects.not.toBeNull();
  });
});
