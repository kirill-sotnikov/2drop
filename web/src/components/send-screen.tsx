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
  const { state, lookup, propose } = useSession();
  const [status, setStatus] = useState("Проверяем получателя…");
  const [available, setAvailable] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [check, setCheck] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

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
        <h1>Некорректный ID</h1>
        <p>Проверьте приглашение или введите ID вручную.</p>
        <Link href="/">На главный экран</Link>
      </section>
    );
  }

  return (
    <>
      <Link href="/" className={styles.backLink}>
        <Icon name="arrow" size={20} style={{ transform: "rotate(180deg)" }} />
        Назад
      </Link>
      <form className={styles.card} onSubmit={submit}>
        <h1 className={styles.recipientHeading}>Получатель {formatId(id)}</h1>
        <div className={styles.recipientStatus} style={{ marginTop: 8 }}>
          <p role="status">
            {state.connection === "online"
              ? status
              : "Ожидаем соединения с сервером…"}
          </p>
          <button
            type="button"
            className={styles.refreshRecipient}
            aria-label="Проверить ещё раз"
            title="Проверить ещё раз"
            style={{
              minHeight: 22,
              width: 22,
            }}
            disabled={state.connection !== "online" || Boolean(busy)}
            onClick={() => setCheck((value) => value + 1)}
          >
            <Icon name="refresh" size={20} />
          </button>
        </div>
        {available && state.connection === "online" && (
          <>
            <label
              className={styles.dropZone}
              data-dragging={draggingFiles}
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

                const droppedFiles = event.dataTransfer.files;

                if (busy || !fileInput.current || !droppedFiles.length) return;
                fileInput.current.files = droppedFiles;
                setFiles(Array.from(droppedFiles));
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
              <Icon name="folder" size={68} />
              <span className={styles.dropPrompt}>
                Перетащите файлы сюда
                <span className={styles.dropBrowse}>
                  или выберите на устройстве
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
                onChange={(event) =>
                  setFiles(Array.from(event.target.files ?? []))
                }
              />
            </label>
            {files.length > 0 && (
              <>
                <p className={styles.muted}>
                  Файлов: {files.length} · {bytesLabel(totalBytes)}
                </p>
                <FileList files={files} />
                {files.length > 1 && (
                  <p className={styles.muted}>
                    Получатель получит все файлы одним ZIP
                  </p>
                )}
              </>
            )}
            {totalBytes > state.maxFileBytes && (
              <p role="alert">Общий размер файлов превышает лимит прототипа</p>
            )}
            {invalidFiles && (
              <p role="alert">
                Можно выбрать до {MAX_FILES_PER_TRANSFER} файлов. Сократите
                список или длину имён.
              </p>
            )}
            <button
              type="submit"
              style={{ display: "block", marginTop: 16, marginLeft: "auto" }}
              disabled={
                !files.length ||
                invalidFiles ||
                totalBytes > state.maxFileBytes ||
                Boolean(busy)
              }
            >
              Отправить
            </button>
          </>
        )}
      </form>
    </>
  );
};
