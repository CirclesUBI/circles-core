import createCore from './helpers/core';
import CoreError from '~/common/error';

let core;

beforeAll(async () => {
  core = createCore();

  // TODO add news to api??
});

describe('News - get latest items', () => {
  beforeAll(async () => {});

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
