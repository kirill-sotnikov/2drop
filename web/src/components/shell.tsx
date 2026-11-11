"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import * as styles from "../app/page.css";
import { useSession } from "../lib/session-context";
import * as homeStyles from "./home-screen.css";
import { Icon } from "./icon";

export const Shell = ({ children }: { readonly children: ReactNode }) => {
  const pathname = usePathname();
  const { state, clearError } = useSession();
  const isHome = pathname === "/";
  const shellStyles = homeStyles;
  const navigation = (
    <nav
      className={shellStyles.nav}
      data-receiving={pathname === "/receive"}
      aria-label="Основная навигация"
    >
      <Link
        href="/"
        className={shellStyles.navLink}
        aria-current={pathname === "/receive" ? undefined : "page"}
      >
        <Icon name="send" size={20} />
        Отправить
      </Link>
      <Link
        href="/receive"
        className={shellStyles.navLink}
        aria-current={pathname === "/receive" ? "page" : undefined}
      >
        <Icon name="receive" size={20} />
        Получить
      </Link>
    </nav>
  );

  return (
    <main className={shellStyles.main}>
      <header className={shellStyles.header}>
        <Link href="/" className={shellStyles.logo}>
          <span className={shellStyles.logoMark}>
            <Icon name="send" size={22} />
          </span>
          <span>
            2drop<span className={shellStyles.dot}>.</span>
          </span>
        </Link>
        {navigation}
      </header>
      {state.error && (
        <div className={shellStyles.notice} role="alert">
          {state.error}{" "}
          <button
            type="button"
            className={homeStyles.footerButton}
            onClick={clearError}
          >
            Закрыть
          </button>
        </div>
      )}
      <div className={isHome ? undefined : styles.screen}>{children}</div>
      <footer className={shellStyles.footer}>
        <p>Без регистрации · Между устройствами</p>
      </footer>
    </main>
  );
};
