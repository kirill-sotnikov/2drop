import { useFormatter } from "next-intl";

export const useBytesLabel = () => {
  const format = useFormatter();

  return (bytes: number) => {
    const unit =
      bytes >= 1_000_000 ? "megabyte" : bytes >= 1_000 ? "kilobyte" : "byte";

    const divisor = bytes >= 1_000_000 ? 1_000_000 : bytes >= 1_000 ? 1_000 : 1;

    return format.number(bytes / divisor, {
      style: "unit",
      unit,
      unitDisplay: "short",
      maximumFractionDigits: 1,
    });
  };
};
