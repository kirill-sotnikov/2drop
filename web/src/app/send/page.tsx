import { SendScreen } from "../../components/send-screen";

const SendPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<{ id?: string | string[] }>;
}) => {
  const { id } = await searchParams;

  return (
    <SendScreen
      key={typeof id === "string" ? id : ""}
      target={typeof id === "string" ? id : ""}
    />
  );
};

export default SendPage;
