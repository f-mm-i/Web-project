const request = require('supertest');
const jwt = require('jsonwebtoken');

// Мокаем модуль pg, чтобы изолировать тесты от реальной БД
const mockQuery = jest.fn();
const mockConnect = jest.fn().mockResolvedValue({
  query: jest.fn(),
  release: jest.fn(),
});

jest.mock('pg', () => {
  return {
    Pool: jest.fn(() => ({
      query: mockQuery,
      connect: mockConnect,
    })),
  };
});

// Мокаем nodemailer, чтобы не отправлять реальные письма во время тестов
const mockSendMail = jest.fn().mockResolvedValue(true);
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

// Подключаем приложение после установки моков
const { app, server } = require('../server');

const SECRET_KEY = 'BookingTours159';

describe('API endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/tours', () => {
    it('должен возвращать список туров (200)', async () => {
      // Мокаем два разных запроса: общий по турам и получение фильтров
      mockQuery.mockImplementation((text, params) => {
        if (text.startsWith('SELECT f.filter_name')) {
          return { rows: [{ filter_name: 'Family' }] };
        }
        return {
          rows: [
            {
              tour_id: 1,
              tour_name: 'Test Tour',
              tour_cost: 100,
              tour_duration: 3,
            },
          ],
        };
      });

      const res = await request(app).get('/api/tours');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toHaveProperty('tour_id', 1);
      expect(mockQuery).toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/login', () => {
    const userRow = {
      client_id: 1,
      client_login: 'testuser',
      client_password: 'password',
      client_name: 'Test',
    };

    it('должен возвращать токен при валидных данных', async () => {
      // Первый даже можно мокаем только SELECT из client
      mockQuery.mockResolvedValue({ rows: [userRow] });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ login: 'testuser', password: 'password' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('token');
      // Проверяем, что токен действительно валиден
      const decoded = jwt.verify(res.body.token, SECRET_KEY);
      expect(decoded.userId).toBe(userRow.client_id);
    });

    it('должен отдавать 400 при неверном пароле', async () => {
      mockQuery.mockResolvedValue({ rows: [userRow] });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ login: 'testuser', password: 'wrong' });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('должен отдавать 400 если пользователь не найден', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ login: 'nouser', password: 'password' });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/tours/book', () => {
    it('должен успешно бронировать тур', async () => {
      // Подготовка моков для транзакции
      const mockClientQuery = jest.fn();
      mockConnect.mockResolvedValue({
        query: mockClientQuery,
        release: jest.fn(),
      });

      // Последовательность вызовов query внутри book маршрута
      // BEGIN
      mockClientQuery.mockResolvedValueOnce({});
      // Проверка существования пользователя
      mockClientQuery.mockResolvedValueOnce({ rows: [{ client_id: 1 }] });
      // Проверка существования тура и seats
      mockClientQuery.mockResolvedValueOnce({
        rows: [{ tour_number_seats: 2, tour_cost: 100 }],
      });
      // INSERT into order
      mockClientQuery.mockResolvedValueOnce({});
      // UPDATE tour seats - ok
      mockClientQuery.mockResolvedValueOnce({});
      // COMMIT
      mockClientQuery.mockResolvedValueOnce({});
      // Получение email пользователя
      mockQuery.mockResolvedValueOnce({ rows: [{ client_email: 'user@example.com' }] });
      // Получение данных тура
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            tour_name: 'Test',
            tour_start_date: new Date(),
            tour_end_date: new Date(),
          },
        ],
      });

      const token = jwt.sign({ userId: 1 }, SECRET_KEY);

      const res = await request(app)
        .post('/api/tours/book')
        .set('Authorization', `Bearer ${token}`)
        .send({ tourId: 5 });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(mockSendMail).toHaveBeenCalled();
    });
  });
});

afterAll((done) => {
  server.close(done);
}); 