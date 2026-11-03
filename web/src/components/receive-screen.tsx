"use client";

import { formatId, totalFileBytes } from "protocol";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import * as styles from "../app/page.css";
import { bytesLabel } from "../lib/format";
import { useSession } from "../lib/session-context";
import { FileList } from "./file-list";
import { Icon } from "./icon";

export const ReceiveScreen = () => {
  const { state, decide, cancel } = useSession();

  const transfer =
    state.transfer?.direction === "receive" ? state.transfer : null;

  const loading =
    transfer &&
    ["connecting", "transferring", "cancelling"].includes(transfer.phase);

  const received =
    !transfer || transfer.phase === "complete" ? state.received : null;

  const files = transfer?.transfer.files ?? received?.files;
  const totalBytes = totalFileBytes(files ?? []);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeout.current !== null) clearTimeout(copyTimeout.current);
    };
  }, []);

  useEffect(() => {
    if (!state.id || !canvas.current) return undefined;

    let live = true;

    const url = new URL("/send", location.origin);

    url.searchParams.set("id", state.id);

    const target = canvas.current;

    const renderCode = async () => {
      try {
        await QRCode.toCanvas(target, url.href, {
          width: 256,
          margin: 2,
          errorCorrectionLevel: "M",
        });
      } catch {
        if (live) setMessage("Не удалось построить QR. Используйте ID.");
      }
    };

    void renderCode();

    return () => {
      live = false;
    };
  }, [state.id]);

  const copy = async () => {
    if (!state.id) return;

    try {
      await navigator.clipboard.writeText(state.id);
      setMessage("ID скопирован.");
      setCopied(true);
      if (copyTimeout.current !== null) clearTimeout(copyTimeout.current);
      copyTimeout.current = setTimeout(() => setCopied(false), 1_000);
    } catch {
      setCopied(false);
      setMessage("Скопируйте ID вручную.");
    }
  };

  return (
    <>
      <section className={styles.card + " " + styles.receive}>
        <p className={styles.muted + " " + styles.receiveDescription}>
          Для отправки файлов отправитель может отсканировать QR код или ввести
          ваш ID
        </p>
        {state.id && (
          <>
            <canvas
              ref={canvas}
              className={styles.qr}
              role="img"
              aria-label={`QR для отправки файла на ID ${formatId(state.id)}`}
            />
            <div className={styles.idRow}>
              <span className={styles.idLabel}>Ваш ID</span>
              <span className={styles.bigId}>{formatId(state.id)}</span>
              <button
                type="button"
                className={styles.copyId}
                onClick={copy}
                aria-label="Скопировать ID"
                title={message || "Скопировать ID"}
              >
                <Icon name={copied ? "check" : "copy"} size={20} />
              </button>
            </div>
            <span className={styles.visuallyHidden} role="status">
              {message}
            </span>
          </>
        )}
      </section>
      {files && (transfer || received) && (
        <section
          className={styles.card + " " + styles.receiveFile}
          aria-label="Получение файлов"
          aria-live="polite"
        >
          <h2 className={styles.fileName}>
            {files.length === 1 ? files[0].name : `Файлов: ${files.length}`}
          </h2>
          <p className={styles.muted}>
            {bytesLabel(totalBytes)}
            {transfer &&
              ` · Отправитель: ${formatId(transfer.transfer.senderId)}`}
          </p>
          {files.length > 1 && (
            <>
              <FileList files={files} />
              <p className={styles.muted}>
                Все файлы будут сохранены одним ZIP.
              </p>
            </>
          )}
          {received && (
            <p className={styles.success}>
              {files.length > 1
                ? "Все файлы получены. ZIP готов к скачиванию."
                : "Файл получен. Теперь его можно сохранить."}
            </p>
          )}
          <div className={styles.actions}>
            {received ? (
              <a
                className={styles.button}
                href={received.url}
                download={received.file.name}
              >
                Скачать
              </a>
            ) : transfer?.phase === "incoming" ? (
              <>
                <button
                  type="button"
                  onClick={() => decide(true)}
                  disabled={state.connection !== "online"}
                >
                  Принять
                </button>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => decide(false)}
                >
                  Отклонить
                </button>
              </>
            ) : loading ? (
              <>
                <button
                  type="button"
                  className={styles.loadingButton}
                  disabled
                  aria-busy="true"
                  aria-label="Получаем файлы"
                >
                  <span className={styles.spinner} aria-hidden="true" />
                  {transfer.phase === "transferring"
                    ? `${Math.round((transfer.bytes / (totalBytes || 1)) * 100)}%`
                    : "Соединяемся…"}
                </button>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={cancel}
                  disabled={transfer.phase === "cancelling"}
                >
                  Отменить передачу
                </button>
              </>
            ) : null}
          </div>
          {transfer?.phase === "ended" && (
            <p role="status">{transfer.message}</p>
          )}
        </section>
      )}
    </>
  );
};
