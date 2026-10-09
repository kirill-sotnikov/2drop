"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { formatId } from "protocol";
import { useSession } from "./session-provider";
import * as styles from "../app/page.css";

export function bytesLabel(bytes: number) {
  if (bytes < 1000) return `${bytes} Б`;
  return `${(bytes / (bytes >= 1_000_000 ? 1_000_000 : 1000)).toLocaleString("ru", { maximumFractionDigits: 1 })} ${bytes >= 1_000_000 ? "МБ" : "КБ"}`;
}
const connectionText = {
  connecting: "Подключаемся…",
  online: "Готов к передаче",
  reconnecting: "Восстанавливаем соединение…",
  error: "Нет соединения",
};

export function Shell({ children }: { children: ReactNode }) {
  const { state, decide, cancel, rotate, discardReceived, clearError } =
    useSession();
  const [shareError, setShareError] = useState("");
  const transfer = state.transfer;
  const busy = transfer && !["complete", "ended"].includes(transfer.phase);
  const transferring =
    transfer &&
    ["connecting", "transferring", "cancelling"].includes(transfer.phase);
  async function share() {
    setShareError("");
    if (!state.received) return;
    try {
      const files = [state.received.file];
      if (!navigator.canShare?.({ files })) {
        setShareError("Для этого файла используйте ссылку «Скачать».");
        return;
      }
      await navigator.share({ files });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setShareError("Не удалось открыть системное меню. Файл можно скачать.");
    }
  }
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <Link href="/" className={styles.logo}>
          2drop<span className={styles.dot}>.</span>
        </Link>
        <span
          className={styles.connection}
          data-online={state.connection === "online"}
        >
          {connectionText[state.connection]}
        </span>
      </header>
      <nav className={styles.nav} aria-label="Основная навигация">
        <Link href="/">Отправить</Link>
        <Link href="/receive">Получить</Link>
        <span className={styles.myId}>
          Ваш ID: <strong>{state.id ? formatId(state.id) : "…"}</strong>
        </span>
      </nav>
      {state.error && (
        <div className={styles.notice} role="alert">
          {state.error}{" "}
          <button className={styles.textButton} onClick={clearError}>
            Закрыть
          </button>
        </div>
      )}
      {children}
      {transfer && (
        <section
          className={styles.card}
          aria-label="Текущая передача"
          aria-live="polite"
        >
          <span className={styles.eyebrow}>
            {transfer.direction === "send" ? "Отправка" : "Получение"}
          </span>
          <h2 className={styles.fileName}>{transfer.transfer.file.name}</h2>
          <p className={styles.muted}>
            {bytesLabel(transfer.transfer.file.size)} ·{" "}
            {transfer.direction === "receive"
              ? `Отправитель: ${transfer.transfer.senderName}`
              : `Получатель: ${formatId(transfer.transfer.receiverId)}`}
          </p>
          {transfer.phase === "incoming" && (
            <>
              <p>Принять этот файл?</p>
              <div className={styles.actions}>
                <button
                  onClick={() => decide(true)}
                  disabled={state.connection !== "online"}
                >
                  Принять
                </button>
                <button
                  className={styles.secondary}
                  onClick={() => decide(false)}
                >
                  Отклонить
                </button>
              </div>
            </>
          )}
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
                {transfer.direction === "send" &&
                transfer.bytes === transfer.transfer.file.size
                  ? " · Ожидаем подтверждения получения…"
                  : ""}
              </p>
            </>
          )}
          {transfer.phase === "complete" && (
            <p className={styles.success}>
              {transfer.direction === "receive"
                ? "Файл получен приложением. Теперь его можно сохранить."
                : "Файл получен получателем."}
            </p>
          )}
          {transfer.phase === "ended" && <p>{transfer.message}</p>}
          {busy && (
            <button
              className={styles.secondary}
              onClick={cancel}
              disabled={transfer.phase === "cancelling"}
            >
              Отменить передачу
            </button>
          )}
        </section>
      )}
      {state.received && (
        <section className={styles.card}>
          <span className={styles.eyebrow}>Готов к сохранению</span>
          <h2 className={styles.fileName}>{state.received.file.name}</h2>
          <div className={styles.actions}>
            <a
              className={styles.button}
              href={state.received.url}
              download={state.received.file.name}
            >
              Скачать
            </a>
            {state.received.canShare && (
              <button className={styles.secondary} onClick={share}>
                Поделиться…
              </button>
            )}
            <button className={styles.textButton} onClick={discardReceived}>
              Удалить из приложения
            </button>
          </div>
          {shareError && <p role="status">{shareError}</p>}
          <p className={styles.muted}>
            Скачивание и сохранение выполняет ваш браузер.
          </p>
        </section>
      )}
      <footer className={styles.footer}>
        <p>Без сжатия · Без регистрации · Через WebRTC</p>
        <p>
          Держите страницу открытой во время передачи. Лимит прототипа:{" "}
          {bytesLabel(state.maxFileBytes)}.
        </p>
        <button
          className={styles.textButton}
          onClick={rotate}
          disabled={Boolean(transferring) || state.connection !== "online"}
        >
          Обновить мой ID
        </button>
      </footer>
    </main>
  );
}
