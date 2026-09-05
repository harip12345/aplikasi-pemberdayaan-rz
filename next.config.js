/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    "@openai/codex",
    "@openai/codex-linux-x64",
    "@openai/codex-linux-arm64",
  ],
  outputFileTracingIncludes: {
    "/api/assistant/**": [
      "./node_modules/@openai/codex/bin/**",
      "./node_modules/@openai/codex-linux-x64/**",
      "./node_modules/@openai/codex-linux-arm64/**",
    ],
    "/api/telegram/**": [
      "./node_modules/@openai/codex/bin/**",
      "./node_modules/@openai/codex-linux-x64/**",
      "./node_modules/@openai/codex-linux-arm64/**",
    ],
  },
};
export default nextConfig;
