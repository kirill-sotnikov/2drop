import * as styles from "./page.css";

export default function HomePage() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>2drop</h1>
      <p className={styles.description}>
        Передача файлов между устройствами через браузер.
      </p>
    </main>
  );
}
