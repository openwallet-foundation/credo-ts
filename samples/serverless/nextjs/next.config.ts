import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  agentRules: false,
  // Askar loads a native library, so it can't be bundled. The sample depends on both packages, so Next.js can resolve them
  serverExternalPackages: ['@openwallet-foundation/askar-nodejs', '@openwallet-foundation/askar-shared'],
}

export default nextConfig
