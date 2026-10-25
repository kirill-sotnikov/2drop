"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatId, normalizeId } from "protocol";
import {
  type ChangeEvent,
  type FormEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import * as styles from "../app/page.css";
import { bytesLabel } from "../lib/format";
import { useSession } from "../lib/session-context";
import { Icon } from "./icon";

export const HomeScreen = () => {
  const { state } = useSession();
  const [id, setId] = useState("");
  const [error, setError] = useState("");
  const recipientInput = useRef<HTMLInputElement>(null);
  const pendingCursor = useRef<number | null>(null);
  const router = useRouter();

  useLayoutEffect(() => {
    if (pendingCursor.current === null) return;

    recipientInput.current?.setSelectionRange(
      pendingCursor.current,
      pendingCursor.current,
    );

    pendingCursor.current = null;
  }, [id]);

  const changeRecipient = (event: ChangeEvent<HTMLInputElement>) => {
    const { value: rawValue, selectionStart } = event.currentTarget;
    const value = rawValue.toUpperCase();

    const cursor = rawValue
      .slice(0, selectionStart ?? rawValue.length)
      .toUpperCase().length;

    const inputType = (event.nativeEvent as InputEvent).inputType;

    const deleting =
      inputType?.startsWith("delete") ||
      (!inputType && rawValue.length < id.length);

    pendingCursor.current = value === rawValue ? null : cursor;

    // Format insertions only, so deleting the separator never puts it back.
    if (!deleting && /^[\da-z]{4,8}$/iu.test(value)) {
      pendingCursor.current = cursor >= 4 ? cursor + 1 : cursor;
      setId(`${value.slice(0, 4)}-${value.slice(4)}`);
    } else {
      setId(value);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();

    const normalized = normalizeId(id);

    if (!normalized) {
      setError("Введите ID из 8 символов, например K7M4-P9RX.");

      return;
    }

    router.push(`/send?id=${normalized}`);
  };

  return (
    <>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Ваш ID для получения файлов</span>
        <h1 className={styles.title}>
          {state.id ? formatId(state.id) : "Подключаемся…"}
        </h1>
      </section>
      <section className={styles.grid} aria-label="Передача файлов">
        <form className={styles.actionCard} onSubmit={submit}>
          <div className={styles.cardHeading}>
            <span className={styles.actionIcon}>
              <Icon name="send" />
            </span>
            <h2 className={styles.cardTitle}>Отправить файл</h2>
          </div>
          <label htmlFor="recipient">ID получателя</label>
          <input
            id="recipient"
            ref={recipientInput}
            value={id}
            onChange={changeRecipient}
            placeholder="A5CD-E2F3"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={32}
            required
          />
          {error && <p role="alert">{error}</p>}
          <button className={styles.cardButton} type="submit">
            Продолжить →
          </button>
        </form>
        <section className={styles.actionCard}>
          <div className={styles.cardHeading}>
            <span className={styles.actionIcon}>
              <Icon name="receive" />
            </span>
            <h2 className={styles.cardTitle}>Получить файл</h2>
          </div>
          <p className={styles.muted}>
            Покажите QR-код или сообщите свой ID отправителю. Передача начнётся
            после вашего согласия.
          </p>
          <Link
            className={
              styles.button + " " + styles.secondary + " " + styles.cardButton
            }
            href="/receive"
          >
            <Icon name="qr" size={20} /> Показать мой QR
          </Link>
        </section>
      </section>
      <section className={styles.banner}>
        <div>
          <h2 className={styles.bannerTitle}>
            Между вами —<br />
            только один клик.
          </h2>
          <p className={styles.bannerDescription}>
            Фото, документы и архивы до {bytesLabel(state.maxFileBytes)}.
            В исходном качестве.
          </p>
        </div>
        <div className={styles.illustration} aria-hidden="true">
          <div className={styles.paperBack} />
          <div className={styles.paperFront}>
            <Icon name="file" size={42} />
          </div>
        </div>
      </section>
      <section className={styles.infoRow}>
        <span className={styles.shieldIcon}>
          <Icon name="shield" />
        </span>
        <div>
          <h2 className={styles.infoTitle}>Передача под вашим контролем</h2>
          <p className={styles.infoText}>
            Файл отправится только с согласия получателя
          </p>
        </div>
      </section>
    </>
  );
};
