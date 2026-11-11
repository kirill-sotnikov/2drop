"use client";

import Link from "next/link";
import {
  filesSchema,
  formatId,
  MAX_FILES_PER_TRANSFER,
  normalizeId,
  totalFileBytes,
} from "protocol";
import { type SubmitEventHandler, useEffect, useRef, useState } from "react";
import * as styles from "../app/page.css";
import { bytesLabel } from "../lib/format";
import { useSession } from "../lib/session-context";
import { FileList } from "./file-list";
import { Icon } from "./icon";
import { PageLoader } from "./page-loader";
import { TransferProgress } from "./transfer-progress";

const fitDropOutline = (outline: SVGRectElement | null) => {
  if (!outline) return undefined;

  const update = () => {
    const dash = 12;
    const targetGap = 16;
    const perimeter = outline.getTotalLength();

    if (perimeter <= dash) return;

    const count = Math.max(1, Math.round(perimeter / (dash + targetGap)));
    const gap = perimeter / count - dash;

    outline.setAttribute("stroke-dasharray", `${dash} ${gap}`);
    // Close the path halfway through a gap so the seam never cuts a dash.
    outline.setAttribute("stroke-dashoffset", String(-gap / 2));
  };

  const observer = new ResizeObserver(update);

  update();
  observer.observe(outline);

  return () => observer.disconnect();
};

export const SendScreen = ({ target }: { readonly target: string }) => {
  const id = normalizeId(target);
  const { state, lookup, propose, cancel } = useSession();
  const [status, setStatus] = useState("Проверяем получателя…");
  const [available, setAvailable] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [check, setCheck] = useState(0);
  const [checkedId, setCheckedId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const transferPanel = useRef<HTMLElement>(null);
  const [dismissedTransfer, setDismissedTransfer] = useState<string | null>(
    null,
  );
  const transfer =
    state.transfer?.direction === "send" &&
    state.transfer.transfer.receiverId === id &&
    state.transfer.transfer.id !== dismissedTransfer
      ? state.transfer
      : null;
  const transferId = transfer?.transfer.id;

  useEffect(() => {
    if (!transferId) return;
    transferPanel.current?.focus({ preventScroll: true });
    transferPanel.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [transferId]);

  useEffect(() => {
    if (!id || state.connection !== "online") return undefined;

    let live = true;
    let inFlight = false;

    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;

      try {
        const result = await lookup(id);

        if (!live) return;
        setAvailable(result === "available");

        setStatus(
          {
            available: "Получатель доступен",
            unavailable: "Получатель недоступен",
            busy: "Получатель занят",
            self: "Это ваш ID. Укажите ID другого устройства.",
          }[result],
        );
      } catch (error) {
        if (live) {
          setAvailable(false);
          setStatus(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (live) setCheckedId(id);
        // eslint-disable-next-line require-atomic-updates -- The guard prevents overlapping refresh calls.
        inFlight = false;
      }
    };

    refresh();

    const interval = setInterval(refresh, 5_000);

    return () => {
      live = false;
      clearInterval(interval);
    };
  }, [id, state.id, state.connection, check, state.transfer?.phase, lookup]);

  const busy =
    state.transfer && !["complete", "ended"].includes(state.transfer.phase);

  const totalBytes = totalFileBytes(files);

  const invalidFiles =
    files.length > 0 &&
    !filesSchema.safeParse(
      files.map((file) => ({
        name: file.name,
        size: file.size,
        mime: file.type,
      })),
    ).success;

  const submit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (id && files.length && state.id) propose(id, files, formatId(state.id));
  };

  if (!id) {
    return (
      <section className={styles.card}>
        <span className={styles.actionIcon}>
          <Icon name="send" />
        </span>
        <h1 className={styles.pageTitle} style={{ marginTop: 24 }}>
          Некорректный ID
        </h1>
        <p>Проверьте приглашение или введите ID вручную.</p>
        <Link href="/" className={styles.button}>
          На главный экран <Icon name="arrow" size={18} />
        </Link>
      </section>
    );
  }

  if (
    !transfer &&
    checkedId !== id &&
    state.connection !== "error" &&
    !state.error
  ) {
    return <PageLoader message="Проверяем получателя…" />;
  }

  return (
    <>
      <div className={styles.pageHeading}>
        <div>
          <h1 className={styles.pageTitle}>Отправить файл</h1>
          {!transfer && (
            <p className={styles.pageDescription}>
              Выберите файлы для получателя.
            </p>
          )}
        </div>
      </div>
      {transfer ? (
        <section
          ref={transferPanel}
          tabIndex={-1}
          className={styles.card}
          aria-label="Текущая передача"
        >
          <h2 className={styles.cardTitle} aria-live="polite">
            {transfer.phase === "complete"
              ? "Файлы отправлены"
              : transfer.phase === "ended"
                ? "Передача завершена"
                : "Передача файлов"}
          </h2>
          <p
            className={styles.fileSummary}
            title={
              transfer.transfer.files.length === 1
                ? transfer.transfer.files[0].name
                : undefined
            }
          >
            {transfer.transfer.files.length === 1
              ? transfer.transfer.files[0].name
              : `Файлов: ${transfer.transfer.files.length}`}
          </p>
          <p className={styles.metadata}>
            {bytesLabel(totalFileBytes(transfer.transfer.files))} · Получатель:{" "}
            {formatId(transfer.transfer.receiverId)}
          </p>
          {transfer.phase === "complete" && (
            <p className={styles.success}>
              {transfer.transfer.files.length === 1
                ? "Файл передан успешно"
                : "Все файлы получены получателем"}
            </p>
          )}
          {transfer.phase === "ended" && (
            <p role="status">{transfer.message}</p>
          )}
          {!["complete", "ended"].includes(transfer.phase) ? (
            <TransferProgress
              transfer={transfer}
              totalBytes={totalFileBytes(transfer.transfer.files)}
              onCancel={cancel}
            />
          ) : (
            <button
              type="button"
              className={styles.sendButton}
              onClick={() => {
                setDismissedTransfer(transfer.transfer.id);
                if (transfer.phase === "complete") setFiles([]);
              }}
            >
              {transfer.phase === "complete"
                ? "Отправить ещё"
                : "Вернуться к файлам"}
            </button>
          )}
        </section>
      ) : (
        <form className={styles.sendCard} onSubmit={submit}>
          <div className={styles.cardHeading}>
            <span className={styles.actionIcon}>
              <Icon name="receive" size={24} />
            </span>
            <h2 className={styles.recipientHeading}>
              <span className={styles.recipientLabel}>Получатель</span>{" "}
              {formatId(id)}
            </h2>
          </div>
          <div className={styles.recipientStatus}>
            <p
              role="status"
              className={styles.connection}
              data-online={available && state.connection === "online"}
            >
              {state.connection === "online"
                ? status
                : "Ожидаем соединения с сервером…"}
            </p>
            <button
              type="button"
              className={styles.refreshRecipient}
              aria-label="Проверить ещё раз"
              title="Проверить ещё раз"
              disabled={state.connection !== "online" || Boolean(busy)}
              onClick={() => setCheck((value) => value + 1)}
            >
              <Icon name="refresh" size={20} />
            </button>
          </div>
          {(!available || state.connection !== "online") && (
            <div className={styles.emptyState}>
              <Icon name="qr" size={32} />
              <p>
                Попросите получателя открыть страницу «Получить» и проверьте его
                ID.
              </p>
              <Link href="/" className={styles.textButton}>
                Ввести другой ID
              </Link>
            </div>
          )}
          {available && state.connection === "online" && (
            <>
              <label
                className={styles.dropZone}
                data-dragging={draggingFiles}
                data-compact={files.length > 0}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!event.dataTransfer.types.includes("Files")) return;

                  event.dataTransfer.dropEffect = busy ? "none" : "copy";
                  setDraggingFiles(!busy);
                }}
                onDragLeave={() => setDraggingFiles(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDraggingFiles(false);

                  const droppedFiles = Array.from(event.dataTransfer.files);

                  if (busy || !fileInput.current || !droppedFiles.length)
                    return;
                  setFiles((current) => [...current, ...droppedFiles]);
                }}
              >
                <svg className={styles.dropOutline} aria-hidden="true">
                  <rect
                    ref={fitDropOutline}
                    width="100%"
                    height="100%"
                    rx={19}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  />
                </svg>
                <Icon name="folder" size={files.length > 0 ? 36 : 68} />
                <span className={styles.dropPrompt}>
                  {files.length > 0 ? "Добавить файлы" : "Выбрать файлы"}
                  <span className={styles.dropBrowse}>
                    <span className={styles.desktopDropHint}>
                      Или перетащите их сюда ·{" "}
                    </span>
                    До {bytesLabel(state.maxFileBytes)} суммарно
                  </span>
                </span>
                <input
                  id="file"
                  ref={fileInput}
                  className={styles.dropInput}
                  type="file"
                  aria-label={`Выберите файлы на устройстве. Файлы до ${bytesLabel(state.maxFileBytes)} суммарно`}
                  multiple
                  disabled={Boolean(busy)}
                  onChange={(event) => {
                    const selected = Array.from(
                      event.currentTarget.files ?? [],
                    );
                    setFiles((current) => [...current, ...selected]);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              {files.length > 0 && (
                <>
                  <p className={styles.metadata}>
                    Файлов: {files.length} · {bytesLabel(totalBytes)}
                  </p>
                  <FileList
                    files={files}
                    onRemove={
                      busy
                        ? undefined
                        : (index) =>
                            setFiles((current) =>
                              current.filter(
                                (_, fileIndex) => fileIndex !== index,
                              ),
                            )
                    }
                  />
                  {files.length > 1 && (
                    <p className={styles.muted}>
                      Получатель получит все файлы одним ZIP
                    </p>
                  )}
                </>
              )}
              {totalBytes > state.maxFileBytes && (
                <p className={styles.error} role="alert">
                  Общий размер файлов превышает лимит прототипа
                </p>
              )}
              {invalidFiles && (
                <p className={styles.error} role="alert">
                  Можно выбрать до {MAX_FILES_PER_TRANSFER} файлов. Сократите
                  список или длину имён.
                </p>
              )}
              <button
                type="submit"
                className={styles.sendButton}
                disabled={
                  !files.length ||
                  invalidFiles ||
                  totalBytes > state.maxFileBytes ||
                  Boolean(busy)
                }
              >
                <Icon name="send" size={20} /> Отправить
              </button>
              {!busy && (
                <p className={styles.transferHint}>
                  Держите страницу открытой во время передачи
                </p>
              )}
            </>
          )}
        </form>
      )}
    </>
  );
};
