"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatId, totalFileBytes } from "protocol";
import { type ReactNode } from "react";
import * as styles from "../app/page.css";
import { bytesLabel } from "../lib/format";
import { useSession } from "../lib/session-context";
import { Icon } from "./icon";
import { TransferProgress } from "./transfer-progress";

export const Shell = ({ children }: { readonly children: ReactNode }) => {
  const pathname = usePathname();
  const { state, cancel, rotate, clearError } = useSession();
  const transfer = state.transfer;
  const totalBytes = totalFileBytes(transfer?.transfer.files ?? []);
  const busy = transfer && !["complete", "ended"].includes(transfer.phase);

  const transferring =
    transfer &&
    ["connecting", "transferring", "cancelling"].includes(transfer.phase);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoMark}>
            <Icon name="send" size={22} />
          </span>
          <span>
            2drop<span className={styles.dot}>.</span>
          </span>
        </Link>
      </header>
      <nav
        className={styles.nav}
        data-receiving={pathname === "/receive"}
        aria-label="Основная навигация"
      >
        <Link
          href="/"
          className={styles.navLink}
          aria-current={pathname === "/receive" ? undefined : "page"}
        >
          <Icon name="send" size={20} />
          Отправить
        </Link>
        <Link
          href="/receive"
          className={styles.navLink}
          aria-current={pathname === "/receive" ? "page" : undefined}
        >
          <Icon name="receive" size={20} />
          Получить
        </Link>
      </nav>
      {state.error && (
        <div className={styles.notice} role="alert">
          {state.error}{" "}
          <button
            type="button"
            className={styles.textButton}
            onClick={clearError}
          >
            Закрыть
          </button>
        </div>
      )}
      {children}
      {transfer?.direction === "send" && pathname === "/send" && (
        <section
          className={styles.card}
          aria-label="Текущая передача"
          aria-live="polite"
        >
          <h2 className={styles.fileName}>
            {transfer.transfer.files.length === 1
              ? transfer.transfer.files[0].name
              : `Файлов: ${transfer.transfer.files.length}`}
          </h2>
          <p className={styles.metadata}>
            {bytesLabel(totalBytes)} · Получатель:{" "}
            {formatId(transfer.transfer.receiverId)}
          </p>
          {transfer.phase === "complete" && (
            <p className={styles.success}>
              {transfer.transfer.files.length === 1
                ? "Файл передан успешно"
                : "Все файлы получены получателем"}
            </p>
          )}
          {transfer.phase === "ended" && <p>{transfer.message}</p>}
          {busy && (
            <TransferProgress
              transfer={transfer}
              totalBytes={totalBytes}
              onCancel={cancel}
            />
          )}
        </section>
      )}
      <footer className={styles.footer}>
        <p>Без регистрации · Между устройствами</p>
        <button
          type="button"
          className={styles.textButton}
          onClick={rotate}
          disabled={Boolean(transferring) || state.connection !== "online"}
        >
          Обновить мой ID
        </button>
      </footer>
    </main>
  );
};
