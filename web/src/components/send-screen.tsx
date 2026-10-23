"use client";

import Link from "next/link";
import { formatId, normalizeId } from "protocol";
import { SubmitEventHandler, useEffect, useState } from "react";
import * as styles from "../app/page.css";
import { Icon } from "./icon";
import { useSession } from "./session-provider";
import { bytesLabel } from "./shell";

export function SendScreen({ target }: { target: string }) {
  const id = normalizeId(target);
  const { state, lookup, propose } = useSession();
  const [status, setStatus] = useState("Проверяем получателя…");
  const [available, setAvailable] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [check, setCheck] = useState(0);

  useEffect(() => {
    if (!id || state.connection !== "online") return;

    let live = true;
    let inFlight = false;

    const refresh = () => {
      if (inFlight) return;
      inFlight = true;
      void lookup(id)
        .then((result) => {
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
        })
        .catch((error: Error) => {
          if (live) {
            setAvailable(false);
            setStatus(error.message);
          }
        })
        .finally(() => {
          inFlight = false;
        });
    };

    refresh();

    const interval = setInterval(refresh, 5000);

    return () => {
      live = false;
      clearInterval(interval);
    };
  }, [id, state.id, state.connection, check, state.transfer?.phase, lookup]);

  const busy =
    state.transfer && !["complete", "ended"].includes(state.transfer.phase);

  const submit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (id && file && state.id) propose(id, file, formatId(state.id));
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
        <span className={styles.eyebrow}>Отправка</span>
        <h1>Получатель {formatId(id)}</h1>
        <p role="status">
          {state.connection === "online"
            ? status
            : "Ожидаем соединения с сервером…"}
        </p>
        <button
          type="button"
          className={styles.textButton}
          disabled={state.connection !== "online" || Boolean(busy)}
          onClick={() => {
            setAvailable(false);
            setCheck((value) => value + 1);
          }}
        >
          Проверить ещё раз
        </button>
        {available && state.connection === "online" && (
          <>
            <label htmlFor="file">
              Один файл до {bytesLabel(state.maxFileBytes)}
            </label>
            <input
              id="file"
              type="file"
              disabled={Boolean(busy)}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            {file && (
              <p className={styles.fileName}>
                {file.name} · {bytesLabel(file.size)}
              </p>
            )}
            {file && file.size > state.maxFileBytes && (
              <p role="alert">Этот файл превышает лимит прототипа.</p>
            )}
            <button
              type="submit"
              disabled={
                !file || file.size > state.maxFileBytes || Boolean(busy)
              }
            >
              Предложить передачу →
            </button>
            <p className={styles.muted}>
              Пока получатель не согласится, отправляются только имя и размер
              файла.
            </p>
          </>
        )}
      </form>
    </>
  );
}
