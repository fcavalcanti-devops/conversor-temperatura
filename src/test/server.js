const request = require('supertest');
const app = require('../server');

describe('API Conversor de Temperatura', () => {

  describe('GET /fahrenheit/:valor/celsius', () => {
    it('retorna 200 e converte 131°F para 55°C', async () => {
      const res = await request(app).get('/fahrenheit/131/celsius');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('celsius', 55);
      expect(res.body).toHaveProperty('maquina');
    });

    it('retorna 200 e converte 32°F para 0°C', async () => {
      const res = await request(app).get('/fahrenheit/32/celsius');
      expect(res.status).toBe(200);
      expect(res.body.celsius).toBe(0);
    });
  });

  describe('GET /celsius/:valor/fahrenheit', () => {
    it('retorna 200 e converte 55°C para 131°F', async () => {
      const res = await request(app).get('/celsius/55/fahrenheit');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('fahrenheit', 131);
      expect(res.body).toHaveProperty('maquina');
    });

    it('retorna 200 e converte 0°C para 32°F', async () => {
      const res = await request(app).get('/celsius/0/fahrenheit');
      expect(res.status).toBe(200);
      expect(res.body.fahrenheit).toBe(32);
    });
  });

  describe('GET /', () => {
    it('retorna 200 e página HTML', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/html/);
    });
  });

  describe('POST /', () => {
    it('retorna 200 ao converter Celsius para Fahrenheit (selectTemp=1)', async () => {
      const res = await request(app)
        .post('/')
        .type('form')
        .send({ valorRef: '100', selectTemp: '1' });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/html/);
    });

    it('retorna 200 ao converter Fahrenheit para Celsius (selectTemp=2)', async () => {
      const res = await request(app)
        .post('/')
        .type('form')
        .send({ valorRef: '212', selectTemp: '2' });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/html/);
    });
  });

  describe('Rotas de health', () => {
    it('GET /health retorna 200 OK', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.text).toBe('OK');
    });

    it('GET /ready retorna 200 ou 500 conforme estado', async () => {
      const res = await request(app).get('/ready');
      expect([200, 500]).toContain(res.status);
    });
  });
});
