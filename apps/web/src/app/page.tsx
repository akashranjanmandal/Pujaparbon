import { redirect } from "next/navigation";

// The public landing page arrives in a later module; for now the root goes to sign-in.
export default function Home() {
  redirect("/login");
}
