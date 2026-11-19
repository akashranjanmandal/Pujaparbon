import { redirect } from "next/navigation";

// No public website: the first screen is the login.
export default function Home() {
  redirect("/login");
}
