/** @type {import('next').NextConfig} */
const nextConfig = {
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
