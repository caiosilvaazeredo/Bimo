import { Injectable } from '@nestjs/common';

export interface ConsentText {
  region: string;
  version: string;
  text: string;
}

/**
 * RNF-PRIV-02: textos de consentimento configuráveis por região. Cada
 * tenant escolhe uma região (Tenant.consentRegion) e o texto exibido no
 * login/cadastro muda de acordo — nunca um único texto genérico para
 * qualquer instituição, já que a base legal muda por jurisdição.
 *
 * Simplificação assumida: os textos ficam hardcoded aqui (não editáveis
 * pelo tenant) — cobre o requisito de "escolher qual texto/base legal se
 * aplica", não um editor de texto livre por instituição. Versão do texto
 * (`version`) existe para permitir auditar "o titular consentiu com qual
 * versão do texto" no futuro, quando o consentimento passar a ser
 * registrado (ainda não é — hoje o texto só é exibido, RNF-PRIV-02 puro).
 */
@Injectable()
export class ConsentTextsService {
  private readonly texts: Record<string, ConsentText> = {
    'BR-LGPD': {
      region: 'BR-LGPD',
      version: '2026-01',
      text:
        'O Bimo trata seu e-mail institucional e o nome exibido pela sua ' +
        'instituição para espelhar turmas entre Google Classroom e ' +
        'Microsoft Teams, nos termos da Lei Geral de Proteção de Dados ' +
        '(Lei 13.709/2018). Você pode solicitar a exclusão dos seus ' +
        'dados a qualquer momento pelo painel.',
    },
    'EU-GDPR': {
      region: 'EU-GDPR',
      version: '2026-01',
      text:
        'Bimo processes your institutional email and display name, as ' +
        'provided by your institution, to mirror classes between Google ' +
        'Classroom and Microsoft Teams, under the General Data ' +
        'Protection Regulation (GDPR). You may request deletion of your ' +
        'data at any time from the dashboard.',
    },
    GENERIC: {
      region: 'GENERIC',
      version: '2026-01',
      text:
        'Bimo processes your institutional email and display name to ' +
        'mirror classes between Google Classroom and Microsoft Teams. ' +
        'You may request deletion of your data at any time from the ' +
        'dashboard.',
    },
  };

  private readonly fallbackRegion = 'GENERIC';

  /** Cai para o texto genérico se a região do tenant não tiver um texto próprio cadastrado. */
  getFor(region: string): ConsentText {
    return this.texts[region] ?? this.texts[this.fallbackRegion];
  }

  listRegions(): string[] {
    return Object.keys(this.texts);
  }
}
