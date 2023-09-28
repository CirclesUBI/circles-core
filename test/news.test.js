import { execSync } from 'child_process';

import createCore from './helpers/core';
import setupWeb3 from './helpers/setupWeb3';
import CoreError from '~/common/error';

describe('News - get latest items', () => {
  const { web3, provider } = setupWeb3();
  let core = createCore(web3);

  afterAll(() => provider.engine.stop());
  beforeAll(async () => {
    execSync(
      `docker exec  circles-db psql -U postgres -d api -c "insert into news (message_en, date, \\"iconId\\", \\"isActive\\") values
      ('News 1', '2022-01-01', 12131232, true),
      ('News 2', '2022-02-02', 12131232, false),
      ('News 3', '2022-03-03', 12131232, true),
      ('News 4', '2022-04-10', 12131232, false),
      ('News 5', '2022-05-11', 12131232, true),
      ('News 6', '2022-06-12', 12131232, false),
      ('News 7', '2022-07-20', 12131232, true),
      ('News 8', '2022-08-21', 12131232, false),
      ('News 9', '2022-09-22', 12131232, true),
      ('News 10', '2022-09-30', 12131232, true);"`,
    );
  });

  describe('when requesting the latest news', () => {
    it('should return all news which are active', async () => {
      const newsResponse = await core.news.getLatestNews({});
      expect(newsResponse.length).toBe(6);
    });
    it('should return all news which are not active', async () => {
      const newsResponse = await core.news.getLatestNews({ isActive: false });
      expect(newsResponse.length).toBe(4);
    });
    it('should limit entries and show active response', async () => {
      const newsResponse = await core.news.getLatestNews({ limit: 5 });
      expect(newsResponse.length).toBe(5);
    });
    it('should limit entries and show inactive response', async () => {
      const newsResponse = await core.news.getLatestNews({
        limit: 3,
        isActive: false,
      });
      expect(newsResponse.length).toBe(3);
    });
    it('should limit entries and start with correct page', async () => {
      const newsResponse = await core.news.getLatestNews({
        limit: 2,
        offset: 2,
      });
      expect(newsResponse[0].message.en).toBe('News 7');
      expect(newsResponse[1].message.en).toBe('News 5');
    });
    it('should filter entries based on afterDate property', async () => {
      const newsResponse = await core.news.getLatestNews({
        limit: 2,
        offset: 2,
        afterDate: new Date('2022-05-15T00:00:00.000Z').toString(),
      });
      expect(newsResponse[0].message.en).toBe('News 7');
      expect(newsResponse.length).toBe(1);
    });
    it('should return an error response when data format is not correct', async () => {
      try {
        await core.news.getLatestNews({ afterDate: true });
        // If no error is thrown, the test should fail
        throw new Error('Expected an error but there was none');
      } catch (error) {
        expect(error).toBeInstanceOf(CoreError);
        expect(error.message).toContain('"afterDate" has invalid type');
      }
    });
  });
});
