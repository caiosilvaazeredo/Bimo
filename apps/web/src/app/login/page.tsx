"use client";

import { useState } from "react";
import { getApiBaseUrl } from "@/lib/api";

export default function LoginPage() {
  const [tenantSlug, setTenantSlug] = useState("");

  const canSubmit = tenantSlug.trim().length > 0;

  function goToOAuth(provider: "google" | "microsoft") {
    if (!canSubmit) return;
    const params = new URLSearchParams({ tenant: tenantSlug.trim() });
    window.location.href = `${getApiBaseUrl()}/auth/${provider}?${params.toString()}`;
  }

  return (
    <main id="main-content" style={{ maxWidth: 420, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Entrar no Bimo</h1>
      <p>
        Informe o identificador da sua instituição e escolha a conta com a qual você já usa o
        Classroom ou o Teams.
      </p>

      <form style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1.5rem" }}>
        <div>
          <label htmlFor="tenant-slug">Identificador da instituição</label>
          <input
            id="tenant-slug"
            name="tenant-slug"
            type="text"
            placeholder="ex: escola-exemplo"
            value={tenantSlug}
            onChange={(event) => setTenantSlug(event.target.value)}
            style={{ display: "block", width: "100%", marginTop: "0.25rem", padding: "0.5rem" }}
          />
        </div>

        <button
          type="button"
          onClick={() => goToOAuth("google")}
          disabled={!canSubmit}
          style={{
            padding: "0.75rem",
            textAlign: "center",
            border: "1px solid #ccc",
            borderRadius: 4,
            background: "white",
            font: "inherit",
            cursor: canSubmit ? "pointer" : "not-allowed",
            opacity: canSubmit ? 1 : 0.5,
          }}
        >
          Entrar com Google
        </button>

        <button
          type="button"
          onClick={() => goToOAuth("microsoft")}
          disabled={!canSubmit}
          style={{
            padding: "0.75rem",
            textAlign: "center",
            border: "1px solid #ccc",
            borderRadius: 4,
            background: "white",
            font: "inherit",
            cursor: canSubmit ? "pointer" : "not-allowed",
            opacity: canSubmit ? 1 : 0.5,
          }}
        >
          Entrar com Microsoft
        </button>
      </form>
    </main>
  );
}
