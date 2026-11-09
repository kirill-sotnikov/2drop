import { type FileMetadata } from "protocol";
import { useId, useState } from "react";
import * as styles from "../app/page.css";
import { archiveNames } from "../lib/archive-names";
import { bytesLabel } from "../lib/format";

const visibleFileLimit = 5;
const filePluralRules = new Intl.PluralRules("ru");

const fileCountForms: Partial<Record<Intl.LDMLPluralRule, string>> = {
  one: "файл",
  few: "файла",
};

export const FileList = ({
  files,
}: {
  readonly files: ReadonlyArray<Pick<FileMetadata, "name" | "size">>;
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
      <ul
        id={listId}
        aria-label="Список файлов"
        style={{
          paddingInlineStart: 16,
          marginBottom: hasOverflow ? 0 : undefined,
        }}
      >
        {archiveNames(visibleFiles.map((file) => file.name)).map(
          (name, index) => (
            <li key={name} className={styles.fileName}>
              {visibleFiles[index].name} ·{" "}
              {bytesLabel(visibleFiles[index].size)}
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
