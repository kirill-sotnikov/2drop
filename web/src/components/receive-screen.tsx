"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { formatId } from "protocol";
import { useSession } from "./session-provider";
import * as styles from "../app/page.css";

export function ReceiveScreen() {
  const { state } = useSession();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!state.id || !canvas.current) return;
    let live = true;
    const url = new URL("/send", location.origin);
    url.searchParams.set("id", state.id);
    void QRCode.toCanvas(canvas.current, url.href, {
      width: 256,
      margin: 2,
      errorCorrectionLevel: "M",
    }).catch(() => {
      if (live) setMessage("Не удалось построить QR. Используйте ID.");
    });
    return () => {
      live = false;
    };
  }, [state.id]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(state.id!);
      setMessage("ID скопирован.");
    } catch {
      setMessage("Скопируйте ID вручную.");
    }
  }
  return (
    <section className={styles.card + " " + styles.receive}>
      <span className={styles.eyebrow}>Получение</span>
      <h1>Покажите этот код</h1>
      <p className={styles.muted}>
        Отправитель может открыть ссылку обычной камерой телефона или ввести ваш
        ID.
      </p>
      {state.id && (
        <>
          <canvas
            ref={canvas}
            className={styles.qr}
            role="img"
            aria-label={`QR для отправки файла на ID ${formatId(state.id)}`}
          />
          <p className={styles.bigId}>{formatId(state.id)}</p>
          <button onClick={copy}>Скопировать ID</button>
        </>
      )}
      <p aria-live="polite">
        {message ||
          (state.connection === "online"
            ? "Ожидаем предложение передачи…"
            : "Подключаемся к серверу…")}
      </p>
      <p className={styles.muted}>
        Содержимое файла начнёт передаваться только после нажатия «Принять».
      </p>
    </section>
  );
}
