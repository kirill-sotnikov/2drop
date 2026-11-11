import { useTranslations } from "next-intl";
import * as styles from "../app/page.css";
import { Icon } from "./icon";

export const TransferNote = () => {
  const translate = useTranslations("transferNote");

  return (
    <section className={styles.infoRow}>
      <span className={styles.shieldIcon}>
        <Icon name="shield" size={22} />
      </span>
      <div>
        <h2 className={styles.infoTitle}>{translate("title")}</h2>
        <p className={styles.infoText}>{translate("description")}</p>
      </div>
    </section>
  );
};
