"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveToken } from "@/lib/session";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      saveToken(token);
      router.replace("/turmas");
    } else {
      router.replace("/login");
    }
  }, [router, searchParams]);

  return (
    <p role="status" aria-live="polite">
      Entrando...
    </p>
  );
}

export default function AuthCallbackPage() {
  return (
    <main id="main-content" style={{ maxWidth: 420, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Bimo</h1>
      <Suspense
        fallback={
          <p role="status" aria-live="polite">
            Entrando...
          </p>
        }
      >
        <CallbackHandler />
      </Suspense>
    </main>
  );
}
