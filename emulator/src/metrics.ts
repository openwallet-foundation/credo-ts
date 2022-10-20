import { ConsoleLogger, LogLevel } from '@aries-framework/core'
import { InfluxDbGossipMetrics } from '@sicpa-dlab/value-transfer-metrics-ts'
import os from 'os'

const influxDbConfig = {
  // You can generate an API token from the "API Tokens Tab" in the UI
  token: 'PsxPtqHVTPON1ln95oCLfxNBKwqcjFltLLM2KOWJ_pa0QH-rHkYFhmZReK0oNpWzIMbPk7xjnBS1MxUNYDIFHA==',
  org: 'dsr',
  bucket: 'dsr-test',
  url: 'http://localhost:8086',
}

const gossipVersion = '1.0'
const machineName = os.hostname()

export const gossipMetricsInstance = new InfluxDbGossipMetrics(
  {
    url: influxDbConfig.url,
    org: influxDbConfig.org,
    bucket: influxDbConfig.bucket,
    token: influxDbConfig.token,
    defaultTags: {
      gossipVersion,
      machineName,
    },
  },
  new ConsoleLogger(LogLevel.error)
)
