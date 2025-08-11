import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const token = cookies().get("directus_access_token")?.value;
  redirect(token ? "/dashboard" : "/login");
} 