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
  const { state, decide, cancel, rotate } = useSession();

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
  const transferPanel = useRef<HTMLElement>(null);
  const instructionsToggle = useRef<HTMLButtonElement>(null);
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const transferKey = transfer?.transfer.id ?? received?.url ?? null;
  const hasTransfer = Boolean(files && (transfer || received));
  const showInstructions = !hasTransfer || expandedFor === transferKey;

  const active = Boolean(
    state.transfer && !["complete", "ended"].includes(state.transfer.phase),
  );

  useEffect(() => {
    if (!transferKey) return;
    transferPanel.current?.focus({ preventScroll: true });

    instructionsToggle.current?.scrollIntoView({
      block: "start",
      behavior: "auto",
    });
  }, [transferKey]);

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

        // Keep the canvas resolution while letting CSS fit it to the card.
        target.style.removeProperty("width");
        target.style.removeProperty("height");

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

  const share = async () => {
    if (!state.id) return;

    const url = new URL("/send", location.origin);

    url.searchParams.set("id", state.id);

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Отправить файлы через 2drop",
          url: url.href,
        });

        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      }
    }

    try {
      await navigator.clipboard.writeText(url.href);
      setMessage("Ссылка скопирована. Отправьте её отправителю.");
    } catch {
      setMessage("Не удалось поделиться ссылкой. Сообщите отправителю ваш ID.");
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
      <div className={styles.pageHeading}>
        <div>
          <h1 className={styles.pageTitle}>Получить файл</h1>
          {!hasTransfer && (
            <p className={styles.pageDescription}>
              Поделитесь ID, ссылкой или QR-кодом.
            </p>
          )}
        </div>
      </div>

      {hasTransfer && (
        <button
          type="button"
          ref={instructionsToggle}
          className={styles.instructionsToggle}
          aria-expanded={showInstructions}
          aria-controls="receive-instructions"
          onClick={() => setExpandedFor(showInstructions ? null : transferKey)}
        >
          <Icon name="qr" size={20} />
          {showInstructions ? "Скрыть инструкцию" : "Показать инструкцию"}
          <span className={styles.toggleHint}>ID и QR-код</span>
          <Icon
            name="arrow"
            size={18}
            style={{
              transform: showInstructions ? "rotate(-90deg)" : "rotate(90deg)",
            }}
          />
        </button>
      )}

      <div id="receive-instructions" hidden={!showInstructions}>
        <section
          className={styles.receive}
          aria-label="Код для получения файлов"
        >
          <div className={styles.receiveDetails}>
            <span className={styles.idLabel}>Ваш ID</span>
            <div className={styles.idRow}>
              <span className={styles.bigId}>{formatId(state.id)}</span>
              <button
                type="button"
                className={styles.copyId}
                data-copied={copied}
                onClick={copy}
                aria-label="Скопировать ID"
                title="Скопировать ID"
              >
                <Icon name={copied ? "check" : "copy"} size={20} />
              </button>
            </div>
            <button
              type="button"
              className={styles.shareButton}
              onClick={share}
            >
              <Icon name="share" size={20} /> Поделиться ссылкой
            </button>
            <button
              type="button"
              className={styles.textButton}
              onClick={rotate}
              disabled={active || state.connection !== "online"}
            >
              Обновить мой ID
            </button>
            {message && (
              <p className={styles.metadata} role="status">
                {message}
              </p>
            )}
            <p className={styles.receiveDescription}>
              Отправитель может ввести этот ID или открыть ссылку.
            </p>
          </div>
          <div className={styles.qrPanel}>
            <div className={styles.qrFrame}>
              <canvas
                key={state.id}
                ref={canvas}
                className={styles.qr}
                style={!qrReady || qrFailed ? { display: "none" } : undefined}
                role="img"
                aria-label={`QR для отправки файла на ID ${formatId(state.id)}`}
              />
              {!qrReady && (
                <p className={styles.metadata} role="status">
                  Подготавливаем QR-код…
                </p>
              )}
              {qrFailed && (
                <p role="status">Не удалось построить QR. Используйте ID.</p>
              )}
            </div>
            <p className={styles.qrCaption}>Или отсканировать QR-код камерой</p>
          </div>
        </section>
        {!hasTransfer && (
          <p className={styles.transferHint}>
            Держите страницу открытой во время передачи файлов
          </p>
        )}
      </div>

      {files && hasTransfer && (
        <section
          ref={transferPanel}
          tabIndex={-1}
          className={styles.card + " " + styles.receiveFile}
          data-phase={transfer?.phase}
          aria-label="Получение файлов"
        >
          <h2 className={styles.cardTitle} aria-live="polite">
            {transfer?.phase === "incoming"
              ? "Вам отправляют файлы"
              : received
                ? "Файлы получены"
                : transfer?.phase === "ended"
                  ? "Передача завершена"
                  : "Получаем файлы"}
          </h2>
          <p
            className={styles.fileSummary}
            title={files.length === 1 ? files[0].name : undefined}
          >
            {files.length === 1 ? files[0].name : `Файлов: ${files.length}`}
          </p>
          <p className={styles.metadata}>
            {bytesLabel(totalBytes)}
            {transfer &&
              ` · Отправитель: ${formatId(transfer.transfer.senderId)}`}
          </p>

          {transfer?.phase === "incoming" && (
            <div className={styles.decisionActions}>
              <button
                type="button"
                className={styles.button}
                onClick={() => decide(true)}
                disabled={state.connection !== "online"}
              >
                <Icon name="receive" size={20} /> Принять
              </button>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => decide(false)}
                disabled={state.connection !== "online"}
              >
                Отклонить
              </button>
            </div>
          )}
          {loading && (
            <TransferProgress
              transfer={transfer}
              totalBytes={totalBytes}
              onCancel={cancel}
            />
          )}
          {received && (
            <>
              <p className={styles.success}>
                {files.length > 1
                  ? "Все файлы получены. Архив готов к скачиванию."
                  : "Файл получен. Теперь его можно сохранить."}
              </p>
              <a
                className={styles.sendButton}
                href={received.url}
                download={received.file.name}
              >
                <Icon name="receive" size={20} /> Сохранить
              </a>
            </>
          )}
          {transfer?.phase === "ended" && (
            <p role="status">{transfer.message}</p>
          )}
          {files.length > 1 && (
            <div className={styles.transferFiles}>
              <FileList files={files} />
              {!received && transfer?.phase !== "ended" && (
                <p className={styles.metadata}>
                  Все файлы будут сохранены одним ZIP.
                </p>
              )}
            </div>
          )}
          {transfer?.phase === "incoming" && (
            <p className={styles.transferHint}>
              Передача начнётся после вашего согласия.
            </p>
          )}
        </section>
      )}
    </>
  );
};
