"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import * as styles from "../app/page.css";

export const PageLoader = ({ message }: { readonly message?: string }) => {
  const translate = useTranslations();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setVisible(true), 2_000);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className={styles.pageLoader} role="status" aria-live="polite">
      {visible && (
        <>
          <span className={styles.pageSpinner} aria-hidden="true" />
          <span className={styles.visuallyHidden}>
            {message ?? translate("loading")}
          </span>
        </>
      )}
    </div>
  );
};
