import * as styles from "../app/page.css";
import { Icon } from "./icon";

export const TransferNote = () => (
  <section className={styles.infoRow}>
    <span className={styles.shieldIcon}>
      <Icon name="shield" size={22} />
    </span>
    <div>
      <h2 className={styles.infoTitle}>Передача под вашим контролем</h2>
      <p className={styles.infoText}>
        Файлы отправятся только с согласия получателя.
      </p>
    </div>
  </section>
);
