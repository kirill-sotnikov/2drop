// ZIP entries are flat filenames. Never allow supplied names to create paths,
// overwrite another entry, or differ only by case on common filesystems.
export const archiveNames = (names: readonly string[]) => {
  const used = new Set<string>();

  return names.map((name) => {
    const base =
      name
        .normalize("NFC")
        .replaceAll(/[\p{Cc}<>:"/\\|?*]/gu, "_")
        .replaceAll(/^[. ]+|[. ]+$/gu, "") || "file";

    const safe = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(base)
      ? `_${base}`
      : base;

    const dot = safe.lastIndexOf(".");
    const stem = dot > 0 ? safe.slice(0, dot) : safe;
    const extension = dot > 0 ? safe.slice(dot) : "";

    let candidate = safe;
    let suffix = 1;

    while (used.has(candidate.toLowerCase())) {
      candidate = `${stem} (${suffix++})${extension}`;
    }

    used.add(candidate.toLowerCase());

    return candidate;
  });
};
