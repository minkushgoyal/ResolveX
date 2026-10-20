/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@resolvex/types", "@resolvex/utils", "@resolvex/ui"],
  experimental: {
    optimizePackageImports: ["lucide-react"]
  }
};

export default nextConfig;
