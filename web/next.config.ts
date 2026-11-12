import path from "node:path";
import { createVanillaExtractPlugin } from "@vanilla-extract/next-plugin";
import { type NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();
const withVanillaExtract = createVanillaExtractPlugin();

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, ".."),
  transpilePackages: ["protocol"],
  allowedDevOrigins: [],
};

export default withNextIntl(withVanillaExtract(nextConfig));
