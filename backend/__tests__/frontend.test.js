/** @jest-environment jsdom */

const path = require('path');

// Загружаем front-end скрипт и извлекаем нужные функции
const {
  sortTours,
  updateTours,
} = require(path.resolve(__dirname, '../../frontend/script.js'));

// Создаем тестовые данные туров
function createTour(id, cost) {
  return {
    tour_id: id,
    tour_url: 'img.jpg',
    tour_name: `Tour ${id}`,
    tour_cost: cost,
    tour_duration: 5,
    tour_filters: ['Пляжный'],
  };
}

describe('Front-end helpers', () => {
  let container;

  beforeEach(() => {
    document.body.innerHTML = '<div id="tours"></div>';
    container = document.getElementById('tours');
  });

  it('updateTours должен отрендерить правильное количество карточек', () => {
    const tours = [createTour(1, 100), createTour(2, 200)];
    updateTours(tours);
    expect(container.querySelectorAll('.tour-card').length).toBe(2);
  });

  it('sortTours корректно сортирует массив по возрастанию', () => {
    global.searchResults = [createTour(1, 300), createTour(2, 100), createTour(3, 200)];

    sortTours('Цене (возр.)');

    const costs = global.searchResults.map((t) => t.tour_cost);
    expect(costs).toEqual([100, 200, 300]);
  });

  it('sortTours корректно сортирует массив по убыванию', () => {
    global.searchResults = [createTour(1, 100), createTour(2, 400), createTour(3, 200)];
    sortTours('Цене (убыв.)');
    const costs = global.searchResults.map((t) => t.tour_cost);
    expect(costs).toEqual([400, 200, 100]);
  });
}); 