import { type FileMetadata } from "protocol";
import * as styles from "../app/page.css";
import { archiveNames } from "../lib/archive-names";
import { bytesLabel } from "../lib/format";

export const FileList = ({
  files,
}: {
  readonly files: ReadonlyArray<Pick<FileMetadata, "name" | "size">>;
}) => (
  <ul aria-label="Список файлов">
    {archiveNames(files.map((file) => file.name)).map((name, index) => (
      <li key={name} className={styles.fileName}>
        {files[index].name} · {bytesLabel(files[index].size)}
      </li>
    ))}
  </ul>
);
