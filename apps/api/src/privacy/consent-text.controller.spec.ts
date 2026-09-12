import { ConsentTextController } from './consent-text.controller';

describe('ConsentTextController (RNF-PRIV-02)', () => {
  const tenantsService = { findActiveBySlug: jest.fn() };
  const consentTextsService = { getFor: jest.fn() };

  let controller: ConsentTextController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ConsentTextController(
      tenantsService as any,
      consentTextsService as any,
    );
  });

  it('resolve o tenant pelo slug e devolve o texto da região configurada', async () => {
    tenantsService.findActiveBySlug.mockResolvedValue({
      id: 'tenant-1',
      slug: 'escola-exemplo',
      consentRegion: 'BR-LGPD',
    });
    consentTextsService.getFor.mockReturnValue({
      region: 'BR-LGPD',
      version: '2026-01',
      text: 'texto',
    });

    const result = await controller.getConsentText('escola-exemplo');

    expect(tenantsService.findActiveBySlug).toHaveBeenCalledWith(
      'escola-exemplo',
    );
    expect(consentTextsService.getFor).toHaveBeenCalledWith('BR-LGPD');
    expect(result).toEqual({
      region: 'BR-LGPD',
      version: '2026-01',
      text: 'texto',
    });
  });
});
