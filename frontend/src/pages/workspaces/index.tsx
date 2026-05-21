import { useRouter } from "next/router";
import { useEffect } from "react";

export default function WorkspacesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/projects");
  }, [router]);

  return null;
}


