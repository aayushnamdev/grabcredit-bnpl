import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/**': ['./mcp-server-dist/**/*'],
  },
};

export default nextConfig;
