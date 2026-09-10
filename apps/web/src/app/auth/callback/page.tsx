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

  return <p>Entrando...</p>;
}

export default function AuthCallbackPage() {
  return (
    <main style={{ maxWidth: 420, margin: "4rem auto", padding: "0 1rem" }}>
      <Suspense fallback={<p>Entrando...</p>}>
        <CallbackHandler />
      </Suspense>
    </main>
  );
}
