import { getMockConnection } from '../../protocols/connections/ConnectionService.test';
import { DidDoc } from '../../protocols/connections/domain/did/DidDoc';
import { IndyAgentService } from '../../protocols/connections/domain/did/service';
import { AgentConfig } from '../AgentConfig';

describe('AgentConfig', () => {
  describe('getEndpoint', () => {
    it('should return the service endpoint of the inbound connection available', () => {
      const agentConfig = new AgentConfig({
        label: 'test',
        walletConfig: { id: 'test' },
        walletCredentials: { key: 'test' },
      });

      const endpoint = 'https://mediator-url.com';
      agentConfig.establishInbound({
        verkey: 'test',
        connection: getMockConnection({
          theirDidDoc: new DidDoc({
            id: 'test',
            publicKey: [],
            authentication: [],
            service: [new IndyAgentService({ id: `test;indy`, serviceEndpoint: endpoint, recipientKeys: [] })],
          }),
        }),
      });

      expect(agentConfig.getEndpoint()).toBe(endpoint);
    });

    it('should return the config endpoint + /msg if no inbound connection is available', () => {
      const endpoint = 'https://local-url.com';

      const agentConfig = new AgentConfig({
        endpoint,
        label: 'test',
        walletConfig: { id: 'test' },
        walletCredentials: { key: 'test' },
      });

      expect(agentConfig.getEndpoint()).toBe(endpoint + '/msg');
    });

    it('should return the config host + /msg if no inbound connection or config endpoint is available', () => {
      const host = 'https://local-url.com';

      const agentConfig = new AgentConfig({
        host,
        label: 'test',
        walletConfig: { id: 'test' },
        walletCredentials: { key: 'test' },
      });

      expect(agentConfig.getEndpoint()).toBe(host + '/msg');
    });

    it('should return the config host and port + /msg if no inbound connection or config endpoint is available', () => {
      const host = 'https://local-url.com';
      const port = 8080;

      const agentConfig = new AgentConfig({
        host,
        port,
        label: 'test',
        walletConfig: { id: 'test' },
        walletCredentials: { key: 'test' },
      });

      expect(agentConfig.getEndpoint()).toBe(`${host}:${port}/msg`);
    });

    // added because on first implementation this is what it did. Never again!
    it('should return the endpoint + /msg without port if the endpoint and port are available', () => {
      const endpoint = 'https://local-url.com';
      const port = 8080;

      const agentConfig = new AgentConfig({
        endpoint,
        port,
        label: 'test',
        walletConfig: { id: 'test' },
        walletCredentials: { key: 'test' },
      });

      expect(agentConfig.getEndpoint()).toBe(`${endpoint}/msg`);
    });

    it("should return 'didcomm:transport/queue' if no inbound connection or config endpoint or host/port is available", () => {
      const agentConfig = new AgentConfig({
        label: 'test',
        walletConfig: { id: 'test' },
        walletCredentials: { key: 'test' },
      });

      expect(agentConfig.getEndpoint()).toBe('didcomm:transport/queue');
    });
  });
});
