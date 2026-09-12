import { ConsentTextsService } from './consent-texts.service';

describe('ConsentTextsService (RNF-PRIV-02)', () => {
  let service: ConsentTextsService;

  beforeEach(() => {
    service = new ConsentTextsService();
  });

  it('retorna o texto em português para a região BR-LGPD', () => {
    const result = service.getFor('BR-LGPD');

    expect(result.region).toBe('BR-LGPD');
    expect(result.text).toMatch(/Lei Geral de Proteção de Dados/);
  });

  it('retorna o texto em inglês para a região EU-GDPR', () => {
    const result = service.getFor('EU-GDPR');

    expect(result.region).toBe('EU-GDPR');
    expect(result.text).toMatch(/General Data Protection Regulation/);
  });

  it('cai para o texto genérico quando a região não é reconhecida', () => {
    const result = service.getFor('REGIAO-INEXISTENTE');

    expect(result.region).toBe('GENERIC');
  });

  it('lista todas as regiões cadastradas', () => {
    expect(service.listRegions()).toEqual(
      expect.arrayContaining(['BR-LGPD', 'EU-GDPR', 'GENERIC']),
    );
  });
});
