import { headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { resolveLocale } from "./locale";

const dictionaries = {
  en: () => import("../content/en.json"),
  ru: () => import("../content/ru.json"),
};

export default getRequestConfig(async () => {
  const locale = resolveLocale((await headers()).get("accept-language"));

  return {
    locale,
    messages: (await dictionaries[locale]()).default,
  };
});
