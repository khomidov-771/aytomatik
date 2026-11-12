import { redirect } from "next/navigation";

export default function RegisterPage() {
  redirect("/setup?auth_mode=register");
}
