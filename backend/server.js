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