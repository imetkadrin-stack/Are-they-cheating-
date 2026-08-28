// Root page – redirects unauthenticated users to /dashboard
import { redirect } from "next/navigation";

export default function HomePage() {
  // For now, always redirect to the dashboard.
  // Add a real auth check here (e.g. session cookie validation) before production use.
  redirect("/dashboard");
}
