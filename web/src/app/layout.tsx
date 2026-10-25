import "./global.css";
import { type Metadata } from "next";
import { type ReactNode } from "react";
import { SessionProvider } from "../components/session-provider";
import { Shell } from "../components/shell";

export const metadata: Metadata = {
  title: "2drop",
  description: "Передача файлов между устройствами через браузер.",
};

const RootLayout = ({ children }: { readonly children: ReactNode }) => {
  return (
    <html lang="ru">
      <body>
        <SessionProvider>
          <Shell>{children}</Shell>
        </SessionProvider>
      </body>
    </html>
  );
};

export default RootLayout;
