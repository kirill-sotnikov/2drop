export const bytesLabel = (bytes: number) => {
  if (bytes < 1_000) return `${bytes} Б`;

  const isMegabytes = bytes >= 1_000_000;
  const divisor = isMegabytes ? 1_000_000 : 1_000;
  const unit = isMegabytes ? "МБ" : "КБ";

  const size = (bytes / divisor).toLocaleString("ru", {
    maximumFractionDigits: 1,
  });

  return `${size} ${unit}`;
};
