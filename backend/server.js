const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const SECRET_KEY = 'BookingTours159';

const nodemailer = require('nodemailer');

// Конфигурация транспорта
const transporter = nodemailer.createTransport({
    host: "baov6wfqx0nrs.mailtrap.ru",
    port: 2525,
    auth: {
        user: "baov6wfqx0nrs",
        pass: "bahtkx3kprxbu"
    },
    tls: {
        rejectUnauthorized: false // Отключаем проверку сертификата
    },
    secure: false
});

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Подключение к базе данных PostgreSQL
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'BookingTours',
  password: '123456',
  port: 5432
});

// Получение всех туров с фильтрацией только по цене и количеству дней
app.get('/api/tours', async (req, res) => {
  try {
      const { maxPrice, maxDays } = req.query;

      // Начальный запрос для всех туров
      let query = `
          SELECT 
              t.*,
              tp.type_name,
              c.complexity_name
          FROM tour t
          LEFT JOIN type tp ON t.type_id = tp.type_id
          LEFT JOIN complexity c ON t.complexity_id = c.complexity_id
          WHERE 1=1
      `; // 1=1 — условие для динамического добавления фильтров

      // Массив для параметров запроса
      const queryParams = [];

      // Фильтрация по цене, если указана
      if (maxPrice) {
          query += ' AND tour_cost <= $1';
          queryParams.push(maxPrice);
      }

      // Фильтрация по количеству дней, если указано
      if (maxDays) {
          query += ' AND tour_duration <= $2';
          queryParams.push(maxDays);
      }

      // Выполнение запроса
      const result = await pool.query(query, queryParams);

      // Для каждого тура получаем связанные фильтры
      for (let tour of result.rows) {
          const filtersQuery = await pool.query(
              'SELECT f.filter_name FROM filter f JOIN tour_filter tf ON f.filter_id = tf.filter_id WHERE tf.tour_id = $1',
              [tour.tour_id]
          );
          tour.tour_filters = filtersQuery.rows.map(row => row.filter_name);
      }

      res.json(result.rows);
  } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
  }
});

app.post('/api/tours/filter', async (req, res) => {
    try {
        const { categories, maxPrice, maxDays, type, season, complexity } = req.body;

        let query = `
            SELECT DISTINCT t.*
            FROM tour t
            LEFT JOIN tour_filter tf ON t.tour_id = tf.tour_id
            LEFT JOIN filter f ON tf.filter_id = f.filter_id
            LEFT JOIN tour_season ts ON t.tour_id = ts.tour_id
            LEFT JOIN season s ON ts.season_id = s.season_id
            LEFT JOIN complexity c ON t.complexity_id = c.complexity_id
            LEFT JOIN type tpe ON t.type_id = tpe.type_id
            WHERE 1=1
        `;

      let queryParams = [];
      let paramIndex = 1; // Индекс параметра для SQL запроса

      // Обрабатываем фильтр по категориям
      if (categories && categories.length > 0) {
          query += ` AND f.filter_name = ANY($${paramIndex++})`;
          queryParams.push(categories);
      }

      // Обрабатываем фильтр по цене
      if (maxPrice) {
          query += ` AND t.tour_cost <= $${paramIndex++}`;
          queryParams.push(maxPrice);
      }

      // Обрабатываем фильтр по количеству дней
      if (maxDays) {
          query += ` AND t.tour_duration <= $${paramIndex++}`;
          queryParams.push(maxDays);
      }

      // Обрабатываем фильтр по типу тура
      if (type && type !== 'Любой') {
          query += ` AND tpe.type_name = $${paramIndex++}`;
          queryParams.push(type);
      }

      // Обрабатываем фильтр по сезону
      if (season && season !== 'Любой') {
          query += ` AND s.season_name = $${paramIndex++}`;
          queryParams.push(season);
      }

      // Обрабатываем фильтр по сложности
      if (complexity && complexity !== 'Любая') {
          query += ` AND c.complexity_name = $${paramIndex++}`;
          queryParams.push(complexity);
      }

      console.log('Используемый запрос:', query);
      console.log('Параметры запроса:', queryParams);

      // Запускаем запрос с переданными параметрами
      const result = await pool.query(query, queryParams);

      // Добавляем получение фильтров для каждого тура
      for (let tour of result.rows) {
          const filtersQuery = await pool.query(
              'SELECT f.filter_name FROM filter f JOIN tour_filter tf ON f.filter_id = tf.filter_id WHERE tf.tour_id = $1',
              [tour.tour_id]
          );
          tour.tour_filters = filtersQuery.rows.map(row => row.filter_name);
      }

      res.json(result.rows);
  } catch (error) {
      console.error('Ошибка на сервере:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
  }
});

const bcrypt = require('bcrypt');

// Авторизация пользователя
app.post('/api/auth/login', async (req, res) => {
    try {
        const { login, password } = req.body;

        // Проверяем, есть ли такой логин в базе
        const userQuery = await pool.query(
            'SELECT * FROM client WHERE client_login = $1',
            [login]
        );

        if (userQuery.rows.length === 0) {
            return res.status(400).json({ error: "Пользователь не найден" });
        }

        const user = userQuery.rows[0];

        // Проверяем пароль
        if (password !== user.client_password) {
            return res.status(400).json({ error: "Неверный пароль" });
        }

        // Генерируем JWT токен
        const token = jwt.sign(
            { userId: user.client_id }, 
            SECRET_KEY, 
            { expiresIn: '1h' }
        );

        res.json({ 
            message: "Вход успешен", 
            token,
            user: { 
                id: user.client_id,
                name: user.client_name,
                login: user.client_login 
            }
        });
    } catch (error) {
        console.error("Ошибка авторизации:", error);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});

app.post('/api/auth/register', async (req, res) => {
    try {        
        const { surname, name, patronymic, email, phone, city, login, password } = req.body;

        // Проверяем, есть ли уже такой логин
        const existingUser = await pool.query(
            'SELECT * FROM client WHERE client_login = $1',
            [login]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: "Логин уже занят" });
        }

        // Добавляем нового клиента в БД
        const newUser = await pool.query(
            `INSERT INTO client (client_surname, client_name, client_patronymic, client_email, client_phone, client_city, client_login, client_password)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING client_id, client_surname, client_name, client_email, client_login;`,
            [surname, name, patronymic, email, phone, city, login, password]
        );

        // Генерируем токен для нового пользователя
        const token = jwt.sign(
            { userId: newUser.rows[0].client_id }, // Берем ID из результата запроса
            SECRET_KEY,
            { expiresIn: '24h' }
        );

        const userData = newUser.rows[0];
        res.status(201).json({ 
            message: "Регистрация успешна", 
            token,
            user: {
                id: userData.client_id,
                name: userData.client_name,
                surname: userData.client_surname,
                email: userData.client_email,
                login: userData.client_login
            }
        });
    } catch (error) {
        console.error("Ошибка регистрации:", error);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});

// checkAuth middleware
const checkAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    const token = authHeader.split(' ')[1];
    
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Сессия истекла' });
            }
            return res.status(401).json({ error: 'Неверный токен' });
        }
        req.userId = decoded.userId;
        next();
    });
};

// Бронирование тура
app.post('/api/tours/book', checkAuth, async (req, res) => {
    const client = await pool.connect(); // Получаем клиента из пула
    try {
        await client.query('BEGIN'); // Начало транзакции

        const { tourId } = req.body;
        const userId = req.userId;

        // 1. Проверка существования пользователя
        const userCheck = await client.query(
            'SELECT client_id FROM client WHERE client_id = $1',
            [userId]
        );
        if (userCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        // 2. Проверка существования тура и блокировка строки
        const tourResult = await client.query(
            `SELECT tour_number_seats, tour_cost 
            FROM tour 
            WHERE tour_id = $1 
            FOR UPDATE NOWAIT`, // Жесткая блокировка для избежания deadlock
            [tourId]
        );
        
        if (tourResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Тур не найден' });
        }

        // 3. Проверка доступности мест
        const availableSeats = tourResult.rows[0].tour_number_seats;
        if (availableSeats < 1) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Нет свободных мест' });
        }

        // 4. Создание записи в заказах
        await client.query(
            `INSERT INTO "order" (
                order_cost, 
                order_date, 
                client_id, 
                tour_id
            ) VALUES ($1, CURRENT_DATE, $2, $3)`,
            [
                tourResult.rows[0].tour_cost,
                userId,
                tourId
            ]
        );

        // 5. Обновление количества мест
        await client.query(
            `UPDATE tour 
            SET tour_number_seats = $1 
            WHERE tour_id = $2`,
            [availableSeats - 1, tourId]
        );

        await client.query('COMMIT');

        // Получаем данные пользователя
        const userData = await pool.query(
            'SELECT client_email FROM client WHERE client_id = $1',
            [userId]
        );

        // Получаем данные тура
        const tourData = await pool.query(
            'SELECT tour_name, tour_start_date, tour_end_date FROM tour WHERE tour_id = $1',
            [tourId]
        );

        // Формируем письмо
        const mailOptions = {
            from: '"Real Tours" <realtours159@yandex.ru>',
            to: userData.rows[0].client_email,
            subject: 'Подтверждение бронирования тура',
            text: `Здравствуйте!
            
            Вы успешно забронировали тур: "${tourData.rows[0].tour_name}".
            Даты: ${new Date(tourData.rows[0].tour_start_date).toLocaleDateString('ru-RU')} - ${new Date(tourData.rows[0].tour_end_date).toLocaleDateString('ru-RU')}.
            
            Наш менеджер свяжется с вами в течение 24 часов для уточнения деталей.
            
            С уважением,
            Команда Real Tours`
        };

        // Отправляем письмо
        await transporter.sendMail(mailOptions);

        res.json({ 
            success: true,
            message: 'Бронирование успешно выполнено. Информация о бронировании направлена на Вашу почту!'
        });
    } catch (error) {
        await client.query('ROLLBACK'); // Откат при ошибке
        if (error.code === '55P03') { // Код ошибки lock-not-available
            return res.status(409).json({ error: 'Тур уже обновляется, попробуйте позже' });
        }

        console.error('Детали ошибки:', {
            message: error.message,
            stack: error.stack,
            query: error.query
        });

        res.status(500).json({
            error: 'Ошибка сервера',
            details: `Код ошибки: ${error.code || 'N/A'} | Сообщение: ${error.message}`
        });
    } finally {
        client.release(); // Важно: возвращаем клиента в пул
    }
});

app.get('/api/user/bookings', checkAuth, async (req, res) => {
    try {
        const userId = req.userId;
        const result = await pool.query(`
            SELECT 
                o.order_id as id,
                t.tour_name,
                t.tour_start_date as start_date,
                t.tour_end_date as end_date,
                o.order_cost::INTEGER as price,  -- Явное преобразование
                o.status
            FROM "order" o
            JOIN tour t ON o.tour_id = t.tour_id
            WHERE o.client_id = $1
            ORDER BY o.order_date DESC
        `, [userId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Ошибка получения бронирований:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});