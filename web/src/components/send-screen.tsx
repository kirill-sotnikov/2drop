"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { formatId, normalizeId } from "protocol";
import { useSession } from "./session-provider";
import { bytesLabel } from "./shell";
import * as styles from "../app/page.css";

export function SendScreen({ target }: { target: string }) {
  const id = normalizeId(target);
  const { state, lookup, propose } = useSession();
  const [status, setStatus] = useState("Проверяем получателя…");
  const [available, setAvailable] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
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
  function submit(event: FormEvent) {
    event.preventDefault();
    if (id && file) propose(id, file, name);
  }
  if (!id)
    return (
      <section className={styles.card}>
        <h1>Некорректный ID</h1>
        <p>Проверьте приглашение или введите ID вручную.</p>
        <Link href="/">На главный экран</Link>
      </section>
    );
  return (
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
          <label htmlFor="sender-name">Как вас представить получателю</label>
          <input
            id="sender-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Отправитель"
            maxLength={80}
            disabled={Boolean(busy)}
          />
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
            disabled={!file || file.size > state.maxFileBytes || Boolean(busy)}
          >
            Предложить передачу →
          </button>
          <p className={styles.muted}>
            Пока получатель не согласится, отправляются только имя и размер
            файла.
          </p>
        </>
      )}
      <p>
        <Link href="/">Другой получатель</Link>
      </p>
    </form>
  );
}
