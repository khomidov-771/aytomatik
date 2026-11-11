import { Suspense } from "react";
import { SetupLoading, SetupWizard } from "@/components/setup-wizard";

export default function SetupPage() {
  return <Suspense fallback={<SetupLoading/>}><SetupWizard/></Suspense>;
}
