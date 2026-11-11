"use client";

import { formatId, totalFileBytes } from "protocol";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import * as styles from "../app/page.css";
import { bytesLabel } from "../lib/format";
import { useSession } from "../lib/session-context";
import { FileList } from "./file-list";
import { Icon } from "./icon";
import { PageLoader } from "./page-loader";
import { TransferProgress } from "./transfer-progress";

// eslint-disable-next-line complexity
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

  const [qrResult, setQrResult] = useState<{
    id: string;
    failed: boolean;
  } | null>(null);

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
    const id = state.id;

    const renderCode = async () => {
      try {
        await QRCode.toCanvas(target, url.href, {
          width: 256,
          margin: 2,
          errorCorrectionLevel: "M",
        });

        if (live) setQrResult({ id, failed: false });
      } catch {
        if (live) setQrResult({ id, failed: true });
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

  if (!state.id) {
    return state.connection === "error" || state.error ? (
      <section className={styles.card}>
        <p role="status">Не удалось получить ID. Проверьте подключение.</p>
      </section>
    ) : (
      <PageLoader message="Подготавливаем получение…" />
    );
  }

  const qrReady = qrResult?.id === state.id;
  const qrFailed = qrReady && qrResult.failed;

  return (
    <>
      {!qrReady && <PageLoader message="Подготавливаем QR-код…" />}
      <div hidden={!qrReady}>
        <section className={styles.card + " " + styles.receive}>
          <p className={styles.muted + " " + styles.receiveDescription}>
            Для отправки файлов отправитель может отсканировать QR код или
            ввести ваш ID
          </p>
          {state.id && (
            <>
              <canvas
                key={state.id}
                ref={canvas}
                className={styles.qr}
                style={qrFailed ? { display: "none" } : undefined}
                role="img"
                aria-label={`QR для отправки файла на ID ${formatId(state.id)}`}
              />
              {qrFailed && (
                <p role="status">Не удалось построить QR. Используйте ID.</p>
              )}
              <div className={styles.idRow}>
                <span className={styles.idLabel}>Ваш ID</span>
                <span className={styles.bigId}>{formatId(state.id)}</span>
                <button
                  type="button"
                  className={styles.copyId}
                  data-copied={copied}
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
            <p className={styles.metadata}>
              {bytesLabel(totalBytes)}
              {transfer &&
                ` · Отправитель: ${formatId(transfer.transfer.senderId)}`}
            </p>
            {files.length > 1 && (
              <>
                <FileList files={files} />
                <p className={styles.muted}>
                  Все файлы будут сохранены одним ZIP
                </p>
              </>
            )}
            {received && (
              <p className={styles.success}>
                {files.length > 1
                  ? "Все файлы получены. Архив готов к скачиванию."
                  : "Файл получен. Теперь его можно сохранить."}
              </p>
            )}
            {loading && (
              <TransferProgress
                transfer={transfer}
                totalBytes={totalBytes}
                onCancel={cancel}
              />
            )}
            {(received || transfer?.phase === "incoming") && (
              <div className={styles.actions}>
                {received ? (
                  <a
                    className={styles.button}
                    href={received.url}
                    download={received.file.name}
                  >
                    Сохранить
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
                ) : null}
              </div>
            )}
            {transfer?.phase === "incoming" && (
              <p className={styles.transferHint}>
                Держите страницу открытой во время передачи
              </p>
            )}
            {transfer?.phase === "ended" && (
              <p role="status">{transfer.message}</p>
            )}
          </section>
        )}
      </div>
    </>
  );
};
