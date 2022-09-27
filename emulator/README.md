## Gossip emulator script

Initial version of Gossip protocol emulator in form of JS script.

It also contains initial implementation of metrics module for Gossip protocol and currently configured to use InfluxDB. See [InfluxDB metrics PoC guide](https://github.com/sicpa-dlab/cbdc-projects/blob/main/docs/metrics/metrics-research-2022-09.md#influxdb-poc)

### Running the script
1. Run `yarn install`
2. To collect metrics, update `influxDbConfig` in [metrics module](./src/metrics.ts)
3. Run `yarn start`