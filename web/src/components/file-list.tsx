import { type FileMetadata } from "protocol";
import { useId, useState } from "react";
import * as styles from "../app/page.css";
import { archiveNames } from "../lib/archive-names";
import { bytesLabel } from "../lib/format";
import { Icon } from "./icon";

const visibleFileLimit = 5;
const filePluralRules = new Intl.PluralRules("ru");

const fileCountForms: Partial<Record<Intl.LDMLPluralRule, string>> = {
  one: "файл",
  few: "файла",
};

export const FileList = ({
  files,
  onRemove,
}: {
  readonly files: ReadonlyArray<Pick<FileMetadata, "name" | "size">>;
  readonly onRemove?: (index: number) => void;
}) => {
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  const remainingFiles = files.length - visibleFileLimit;
  const hasOverflow = remainingFiles > 0;
  const visibleFiles = expanded ? files : files.slice(0, visibleFileLimit);

  const fileCountForm =
    fileCountForms[filePluralRules.select(remainingFiles)] ?? "файлов";

  return (
    <>
      <ul id={listId} aria-label="Список файлов" className={styles.fileList}>
        {archiveNames(visibleFiles.map((file) => file.name)).map(
          (name, index) => (
            <li
              key={name}
              className={styles.fileRow}
              data-removable={Boolean(onRemove)}
            >
              <span className={styles.fileName}>
                {visibleFiles[index].name}
              </span>
              <span className={styles.fileSize}>
                {bytesLabel(visibleFiles[index].size)}
              </span>
              {onRemove && (
                <button
                  type="button"
                  className={styles.removeFile}
                  onClick={() => onRemove(index)}
                  aria-label={`Удалить ${visibleFiles[index].name}`}
                >
                  <Icon name="close" size={18} />
                </button>
              )}
            </li>
          ),
        )}
      </ul>
      {hasOverflow && (
        <button
          type="button"
          className={styles.fileListToggle}
          aria-controls={listId}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Свернуть" : `Ещё ${remainingFiles} ${fileCountForm}`}
        </button>
      )}
    </>
  );
};
