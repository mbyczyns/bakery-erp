import { redirect } from "next/navigation";

export default function KosztyRedirectPage() {
    redirect("/finanse?tab=koszty");
}