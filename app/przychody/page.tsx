import { redirect } from "next/navigation";

export default function PrzychodyRedirectPage() {
    redirect("/finanse?tab=przychody");
}