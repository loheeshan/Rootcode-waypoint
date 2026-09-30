import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  transpilePackages: ['@waypoint/web-ui', '@waypoint/design-tokens', '@waypoint/api-contracts', '@waypoint/shared-types'],
};
export default nextConfig;
