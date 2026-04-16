import request from 'supertest';
import createApp from '../src/app';

const app = createApp();

describe('Basic Academy API Tests', () => {
  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/academy/api/v1/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Academy API is running');
      expect(response.body.service).toBe('academy-api');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Root Health Check', () => {
    it('should return root health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Academy API is running');
      expect(response.body.service).toBe('academy-api');
    });
  });
});
