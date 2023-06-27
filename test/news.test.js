import createCore from './helpers/core';

let core;

beforeAll(async () => {
  core = createCore();
});

describe('News - get latest items', () => {
  beforeAll(async () => {
  });

  describe('when requesting the latest news', () => {
    it('should return an empty string', async () => {
      const news = core.news.getLatestNews();
      expect(news.length()).toBe(0);
    });
    it('should return a success response', async () => {
      const news = core.news.getLatestNews();
      expect(news.length()).toBe(0);
    });
  });
});

describe('News - other', () => {
  beforeAll(async () => {
  });

  describe('when unknown query', () => {
    it('should be..', async () => {
      expect(0).toBe(0);
    });
  });
});
