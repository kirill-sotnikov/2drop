import { createVanillaExtractPlugin } from "@vanilla-extract/next-plugin";
import { type NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();
const withVanillaExtract = createVanillaExtractPlugin();

const nextConfig: NextConfig = {
  transpilePackages: ["protocol"],
  allowedDevOrigins: ["lt.maninshorts.ru"],
};

export default withNextIntl(withVanillaExtract(nextConfig));
