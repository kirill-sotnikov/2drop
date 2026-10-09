"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { normalizeId } from "protocol";
import * as styles from "../app/page.css";

export function HomeScreen() {
  const [id, setId] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeId(id);
    if (!normalized) {
      setError("Введите ID из 8 символов, например K7M4-P9RX.");
      return;
    }
    router.push(`/send?id=${normalized}`);
  }
  return (
    <>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>С одного устройства на другое</span>
        <h1 className={styles.title}>
          Ваш файл.
          <br />
          На другом экране.
        </h1>
        <p className={styles.description}>
          Фото, документ или архив — передайте исходный файл прямо через
          браузер.
        </p>
      </section>
      <section className={styles.grid}>
        <form className={styles.card} onSubmit={submit}>
          <h2>Отправить файл</h2>
          <label htmlFor="recipient">ID получателя</label>
          <input
            id="recipient"
            value={id}
            onChange={(event) => setId(event.target.value)}
            placeholder="K7M4-P9RX"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={32}
            required
          />
          {error && <p role="alert">{error}</p>}
          <button type="submit">Продолжить →</button>
        </form>
        <section className={styles.card}>
          <h2>Получить файл</h2>
          <p className={styles.muted}>
            Покажите QR-код или сообщите свой ID отправителю. Передача начнётся
            после вашего согласия.
          </p>
          <Link
            className={styles.button + " " + styles.secondary}
            href="/receive"
          >
            Показать мой QR
          </Link>
        </section>
      </section>
    </>
  );
}
