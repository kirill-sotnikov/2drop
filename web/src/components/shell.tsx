"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatId } from "protocol";
import { type ReactNode } from "react";
import * as styles from "../app/page.css";
import { bytesLabel } from "../lib/format";
import { useSession } from "../lib/session-context";
import { Icon } from "./icon";

const connectionText = {
  connecting: "Подключаемся…",
  online: "Готов к передаче",
  reconnecting: "Восстанавливаем соединение…",
  error: "Нет соединения",
};

export const Shell = ({ children }: { readonly children: ReactNode }) => {
  const pathname = usePathname();
  const { state, cancel, rotate, clearError } = useSession();
  const transfer = state.transfer;
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
        <span
          className={styles.connection}
          data-online={state.connection === "online"}
        >
          {connectionText[state.connection]}
        </span>
      </header>
      <nav className={styles.nav} aria-label="Основная навигация">
        <Link
          href="/"
          className={styles.navLink}
          aria-current={pathname === "/receive" ? undefined : "page"}
        >
          <Icon name="send" size={22} />
          Отправить
        </Link>
        <Link
          href="/receive"
          className={styles.navLink}
          aria-current={pathname === "/receive" ? "page" : undefined}
        >
          <Icon name="receive" size={22} />
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
      {transfer?.direction === "send" && pathname !== "/receive" && (
        <section
          className={styles.card}
          aria-label="Текущая передача"
          aria-live="polite"
        >
          <span className={styles.eyebrow}>Отправка</span>
          <h2 className={styles.fileName}>{transfer.transfer.file.name}</h2>
          <p className={styles.muted}>
            {bytesLabel(transfer.transfer.file.size)} · Получатель:{" "}
            {formatId(transfer.transfer.receiverId)}
          </p>
          {transfer.phase === "offering" && (
            <p>Ожидаем подтверждения получателя…</p>
          )}
          {transfer.phase === "connecting" && <p>Соединяем устройства…</p>}
          {transfer.phase === "cancelling" && <p>Отменяем передачу…</p>}
          {transfer.phase === "transferring" && (
            <>
              <progress
                aria-label="Прогресс передачи"
                max={transfer.transfer.file.size || 1}
                value={transfer.bytes}
              />
              <p>
                {bytesLabel(transfer.bytes)} /{" "}
                {bytesLabel(transfer.transfer.file.size)}
                {transfer.bytes === transfer.transfer.file.size
                  ? " · Ожидаем подтверждения получения…"
                  : ""}
              </p>
            </>
          )}
          {transfer.phase === "complete" && (
            <p className={styles.success}>Файл получен получателем.</p>
          )}
          {transfer.phase === "ended" && <p>{transfer.message}</p>}
          {busy && (
            <button
              type="button"
              className={styles.secondary}
              onClick={cancel}
              disabled={transfer.phase === "cancelling"}
            >
              Отменить передачу
            </button>
          )}
        </section>
      )}
      <footer className={styles.footer}>
        <p>Без регистрации · Между устройствами</p>
        <p>
          Держите страницу открытой во время передачи. Лимит прототипа:{" "}
          {bytesLabel(state.maxFileBytes)}.
        </p>
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
