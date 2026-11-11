"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { normalizeId } from "protocol";
import {
  type ChangeEvent,
  type FormEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { FileIllustration } from "./file-illustration";
import * as homeStyles from "./home-screen.css";
import { Icon } from "./icon";

export const HomeScreen = () => {
  const translate = useTranslations();
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
    setError("");

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
      setError(translate("mainPage.invalidId"));

      return;
    }

    router.push(`/send?id=${normalized}`);
  };

  return (
    <div className={homeStyles.content}>
      <section className={homeStyles.hero} aria-labelledby="home-title">
        <div className={homeStyles.heroCopy}>
          <h1 id="home-title" className={homeStyles.title}>
            {translate("mainPage.title")}
            <br />
            <span className={homeStyles.highlight}>
              {translate("mainPage.titleHighlight")}
            </span>
          </h1>
          <p className={homeStyles.intro}>{translate("mainPage.intro")}</p>
        </div>
        <div className={homeStyles.artwork}>
          <FileIllustration />
          <span className={homeStyles.artSticker}>p2p</span>
        </div>
      </section>

      <section
        className={homeStyles.actions}
        aria-label={translate("mainPage.title")}
      >
        <form className={homeStyles.sendCard} onSubmit={submit}>
          <div className={homeStyles.cardHeading}>
            <span className={homeStyles.sendIcon}>
              <Icon name="send" size={26} />
            </span>
            <div>
              <h2 className={homeStyles.cardTitle}>{translate("sendFile")}</h2>
            </div>
          </div>
          <p className={homeStyles.description}>
            {translate("mainPage.sendDescription")}
          </p>
          <label className={homeStyles.label} htmlFor="recipient">
            {translate("mainPage.recipientId")}
          </label>
          <div className={homeStyles.inputRow}>
            <input
              className={homeStyles.recipient}
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
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "recipient-error" : undefined}
            />
            <button className={homeStyles.cardButton} type="submit">
              {translate("continue")}
            </button>
          </div>
          {error && (
            <p id="recipient-error" className={homeStyles.error} role="alert">
              {error}
            </p>
          )}
        </form>

        <section className={homeStyles.receiveCard}>
          <div className={homeStyles.cardHeading}>
            <span className={homeStyles.receiveIcon}>
              <Icon name="receive" size={26} />
            </span>
            <div>
              <h2 className={homeStyles.cardTitle}>
                {translate("receiveFile")}
              </h2>
            </div>
          </div>
          <p className={homeStyles.description}>
            {translate("mainPage.receiveDescription")}
          </p>
          <Link className={homeStyles.receiveButton} href="/receive">
            <Icon name="qr" size={22} /> {translate("mainPage.showQr")}
          </Link>
        </section>
      </section>

      <section className={homeStyles.infoRow}>
        <span className={homeStyles.shieldIcon}>
          <Icon name="shield" size={23} />
        </span>
        <div>
          <h2 className={homeStyles.infoTitle}>
            {translate("mainPage.consentTitle")}
          </h2>
          <p className={homeStyles.infoText}>
            {translate("mainPage.consentDescription")}
          </p>
        </div>
        <span className={homeStyles.infoDoodle} aria-hidden="true">
          ✳
        </span>
      </section>
    </div>
  );
};
