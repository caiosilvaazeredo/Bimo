"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, TurmaEspelhada, createTurmaEspelhada, listTurmasEspelhadas } from "@/lib/api";
import { clearToken, getToken } from "@/lib/session";

const STATUS_LABEL: Record<TurmaEspelhada["syncStatus"], string> = {
  SYNCING: "Sincronizando",
  SYNCED: "Sincronizado",
  CONFLICT: "Conflito",
  ERROR: "Erro na sincronização",
};

export default function TurmasPage() {
  const router = useRouter();
  const [turmas, setTurmas] = useState<TurmaEspelhada[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [academicPeriod, setAcademicPeriod] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      setTurmas(await listTurmasEspelhadas());
    } catch (err) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  }

  function handleApiError(err: unknown) {
    if (err instanceof ApiError && err.status === 401) {
      clearToken();
      router.replace("/login");
      return;
    }
    setError(err instanceof Error ? err.message : "Não foi possível falar com o Bimo agora.");
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createTurmaEspelhada({ name, academicPeriod: academicPeriod || undefined });
      setName("");
      setAcademicPeriod("");
      await reload();
    } catch (err) {
      handleApiError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main id="main-content" style={{ maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Minhas turmas espelhadas</h1>

      <form
        onSubmit={handleCreate}
        style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "1.5rem 0" }}
      >
        <div>
          <label htmlFor="turma-name">Nome da turma</label>
          <input
            id="turma-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            style={{ display: "block", padding: "0.5rem" }}
          />
        </div>
        <div>
          <label htmlFor="turma-period">Período letivo</label>
          <input
            id="turma-period"
            value={academicPeriod}
            onChange={(event) => setAcademicPeriod(event.target.value)}
            placeholder="ex: 2026.2"
            style={{ display: "block", padding: "0.5rem" }}
          />
        </div>
        <button type="submit" disabled={submitting || !name} style={{ alignSelf: "flex-end", padding: "0.6rem 1rem" }}>
          {submitting ? "Criando..." : "Criar turma espelhada"}
        </button>
      </form>

      {error && (
        <p role="alert" style={{ color: "#b00020" }}>
          {error}
        </p>
      )}

      <p role="status" aria-live="polite" style={visuallyHidden}>
        {loading
          ? "Carregando turmas..."
          : `${turmas.length} turma${turmas.length === 1 ? "" : "s"} carregada${turmas.length === 1 ? "" : "s"}.`}
      </p>

      {loading ? (
        <p>Carregando...</p>
      ) : turmas.length === 0 ? (
        <p>Nenhuma turma espelhada ainda.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <caption style={visuallyHidden}>Minhas turmas espelhadas e status de sincronização</caption>
          <thead>
            <tr>
              <th scope="col" style={cellStyle}>Turma</th>
              <th scope="col" style={cellStyle}>Status</th>
              <th scope="col" style={cellStyle}>Google</th>
              <th scope="col" style={cellStyle}>Microsoft</th>
            </tr>
          </thead>
          <tbody>
            {turmas.map((turma) => (
              <tr key={turma.id}>
                <td style={cellStyle}>{turma.name}</td>
                <td style={cellStyle}>{STATUS_LABEL[turma.syncStatus]}</td>
                <td style={cellStyle}>
                  {turma.googleCourseId ? (
                    turma.googleCourseUrl ? (
                      <a href={turma.googleCourseUrl} target="_blank" rel="noreferrer">
                        Abrir no Classroom
                        <span style={visuallyHidden}> (abre em nova aba)</span>
                      </a>
                    ) : (
                      "Criado"
                    )
                  ) : (
                    "Pendente"
                  )}
                </td>
                <td style={cellStyle}>
                  {turma.microsoftTeamId ? (
                    turma.microsoftTeamUrl ? (
                      <a href={turma.microsoftTeamUrl} target="_blank" rel="noreferrer">
                        Abrir no Teams
                        <span style={visuallyHidden}> (abre em nova aba)</span>
                      </a>
                    ) : (
                      "Criado"
                    )
                  ) : (
                    "Pendente"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

const cellStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.5rem",
  borderBottom: "1px solid #ddd",
};

/** RNF-UX-01: some visualmente mas fica disponível para leitores de tela. */
const visuallyHidden: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};
