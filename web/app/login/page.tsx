import { redirect } from "next/navigation";

export default function LoginPage() {
  redirect("/setup?auth_mode=login");
}
