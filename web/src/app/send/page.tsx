import { SendScreen } from "../../components/send-screen";

export default async function SendPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const { id } = await searchParams;
  return (
    <SendScreen
      key={typeof id === "string" ? id : ""}
      target={typeof id === "string" ? id : ""}
    />
  );
}
