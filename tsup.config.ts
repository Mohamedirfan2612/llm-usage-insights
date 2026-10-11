import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    pricing: "src/pricing.ts",
    "providers/index": "src/providers/index.ts"
  },
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  external: ["openai", "@anthropic-ai/sdk"]
});
