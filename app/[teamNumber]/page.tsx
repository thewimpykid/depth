import { redirect } from "next/navigation";

export default async function LegacyTeamPage(props: PageProps<"/[teamNumber]">) {
  const { teamNumber } = await props.params;
  redirect(`/teams?q=${encodeURIComponent(teamNumber)}`);
}
