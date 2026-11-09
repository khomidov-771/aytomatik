"use client";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import { AutomationForm } from "@/components/automation-form";
export default function EditAutomationPage(){const params=useParams<{id:string}>();return <Suspense><AutomationForm id={params.id}/></Suspense>}
