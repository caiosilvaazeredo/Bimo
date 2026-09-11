/**
 * Teste de carga para validar RNF-PERF-01/03: painel do professor
 * abaixo de 2s p95, suportando a escala piloto (50 turmas, 2.000
 * alunos ativos simultâneos por tenant) sem degradação perceptível.
 *
 * Não foi executado nesta sessão (sem servidor/banco Oracle real
 * disponível no ambiente de desenvolvimento) — é o ponto de partida
 * para rodar contra um ambiente de staging real antes do piloto.
 *
 * Uso: k6 run -e BASE_URL=https://staging.bimo.example -e TOKEN=<jwt> loadtest/turmas-espelhadas.k6.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN;

export const options = {
  scenarios: {
    painel_professor: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '2m', target: 50 }, // ~50 turmas ativas simultâneas (RNF-PERF-03)
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    // RNF-PERF-01: carregamento de turma/lista de tarefas < 2s no p95.
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const headers = { Authorization: `Bearer ${TOKEN}` };

  const list = http.get(`${BASE_URL}/turmas-espelhadas`, { headers });
  check(list, { 'GET /turmas-espelhadas 200': (r) => r.status === 200 });

  sleep(1);
}
