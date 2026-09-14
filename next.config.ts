import path from 'path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // This app lives in a subdirectory of a repository that contains another,
  // unrelated Next.js application. Without an explicit root, Next walks up and
  // finds that project's lockfile, which makes its file tracing (and therefore
  // a standalone build) wrong.
  outputFileTracingRoot: path.join(__dirname),
}

export default nextConfig
