import { requireChatGPTUser, type ChatGPTUser } from "./chatgpt-auth";
import { IdentityBrief } from "./identity-brief";

export const dynamic = "force-dynamic";

const localReviewer: ChatGPTUser = {
  displayName: "Private reviewer",
  email: "reviewer@local",
  fullName: "Private reviewer",
};

export default async function Home() {
  const user =
    process.env.NODE_ENV === "development"
      ? localReviewer
      : await requireChatGPTUser("/");

  return <IdentityBrief reviewerName={user.displayName} />;
}
