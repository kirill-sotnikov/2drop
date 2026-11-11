import "./global.css";
import { type Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { type ReactNode } from "react";
import { SessionProvider } from "../components/session-provider";
import { Shell } from "../components/shell";

export const generateMetadata = async (): Promise<Metadata> => {
  const translate = await getTranslations();

  return { title: "2drop", description: translate("description") };
};

const RootLayout = async ({ children }: { readonly children: ReactNode }) => {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <SessionProvider>
            <Shell>{children}</Shell>
          </SessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
};

export default RootLayout;
