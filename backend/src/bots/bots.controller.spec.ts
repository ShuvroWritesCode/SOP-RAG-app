import { BotsController } from './bots.controller';

describe('BotsController', () => {
  let controller: BotsController;

  beforeEach(() => {
    controller = new BotsController({} as any);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
