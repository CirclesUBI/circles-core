import createCore from './helpers/core';

let core;

beforeAll(async () => {
  core = createCore();

  // TODO add news to api??
});

describe('News - get latest items', () => {
  beforeAll(async () => {});

  describe('when requesting the latest news', () => {
    it('should return an empty string', async () => {
      //const newsResponse =
      await core.news.getLatestNews({ isActive: true });
      //console.log(newsResponse);
      expect(0).toBe(0);
    });
    it('should return a success response', async () => {
      //const news = await core.news.getLatestNews();
      expect(0).toBe(0);
    });
  });
});

describe('News - other', () => {
  beforeAll(async () => {});

  describe('when unknown query', () => {
    it('should be..', async () => {
      expect(0).toBe(0);
    });
  });
});
