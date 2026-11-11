import Link from "next/link";
import { useTranslations } from "next-intl";
import * as styles from "./page.css";

const NotFound = () => {
  const translate = useTranslations();

  return (
    <section className={styles.card}>
      <h1 className={styles.pageTitle}>{translate("notFound.title")}</h1>
      <Link className={styles.button} href="/">
        {translate("backHome")}
      </Link>
    </section>
  );
};

export default NotFound;
