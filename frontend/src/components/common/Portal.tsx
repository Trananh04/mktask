import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

//Portal to display confirmation modal at the top of the screen
export default function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setContainer(document.getElementById("taskosaur-portal-root") || document.body);
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || !container) return null;

  return createPortal(children, container);
}
