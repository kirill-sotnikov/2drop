import { createVanillaExtractPlugin } from "@vanilla-extract/next-plugin";
import type { NextConfig } from "next";

const withVanillaExtract = createVanillaExtractPlugin();

const nextConfig: NextConfig = {
  transpilePackages: ["protocol"],
  allowedDevOrigins: ["shkryp.ru"],
};

export default withVanillaExtract(nextConfig);
