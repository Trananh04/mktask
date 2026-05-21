import { useEffect } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();

  // Redirect to the app; auth bootstrap will send managers to dashboard.
  useEffect(() => {
    router.push("/dashboard");
  }, [router]);

  // Return minimal content as it will be redirected immediately
  return null;
}
