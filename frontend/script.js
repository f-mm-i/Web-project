let currentTour = null;
let allTours = [];
let searchResults = [];

document.addEventListener("DOMContentLoaded", () => {
    checkAuthState();

    // Проверка авторизации для profile.html
    if (window.location.pathname.includes('profile.html')) {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user'));

        if (!token || !user) {
            window.location.href = 'tours.html';
            return;
        }

        // Загрузка данных пользователя
        document.getElementById('userName').textContent = user.name || 'Пользователь';
        document.getElementById('userEmail').textContent = user.email || 'Не указан';
    }

    if (window.location.pathname.includes('profile.html')) {
        // Загрузка истории бронирований
        const loadBookings = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch('http://localhost:3000/api/user/bookings', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                const bookings = await response.json();
                const container = document.querySelector('.bookings-list');

                container.innerHTML = bookings.map(booking => `
                    <div class="booking-item">
                        <div class="booking-header">
                            <span>Тур: "${booking.tour_name}"</span>
                            <span class="booking-status ${booking.status}">${booking.status}</span>
                        </div>
                        <div class="booking-details">
                            <p>Даты: ${new Date(booking.start_date).toLocaleDateString('ru-RU')} - ${new Date(booking.end_date).toLocaleDateString('ru-RU')}</p>
                            <p>Стоимость: ${Number(booking.price).toLocaleString()} ₽</p>
                        </div>
                    </div>
                `).join('');

            } catch (error) {
                console.error('Ошибка:', error);
                container.innerHTML = `<div class="error">Ошибка загрузки данных</div>`;
            }
        };

        loadBookings();
    }

    const priceRange = document.getElementById("priceRange");
    const priceValue = document.getElementById("priceValue");
    const daysRange = document.getElementById("daysRange");
    const daysValue = document.getElementById("daysValue");
    const resetFiltersBtn = document.getElementById("resetFilters");
    const categoriesInput = document.querySelectorAll(".filter-group input[type='checkbox']");
    const typeInput = document.getElementById("typeInput");
    const seasonInput = document.getElementById("seasonInput");
    const complexityInput = document.getElementById("complexityInput");
    const sortSelect = document.querySelector(".sort-select");

    priceRange.addEventListener("input", () => {
        priceValue.textContent = `${priceRange.value} ₽`;
    });

    daysRange.addEventListener("input", () => {
        daysValue.textContent = `${daysRange.value} дней`;
    });

    resetFiltersBtn.addEventListener("click", () => {
        priceRange.value = 50000;
        priceValue.textContent = "50000 ₽";
        daysRange.value = 7;
        daysValue.textContent = "7 дней";
        typeInput.value = "Любой";
        seasonInput.value = "Любой";
        complexityInput.value = "Любая";
        sortSelect.value = "Умолчанию";
        categoriesInput.forEach(checkbox => checkbox.checked = false);
        applyFilters();
    });

    document.getElementById('searchBtn').addEventListener('click', applySearch);
    document.getElementById('applyFilters').addEventListener('click', applyFilters);

    fetch('http://localhost:3000/api/tours')
        .then(response => response.json())
        .then(tours => {
            allTours = tours;
            searchResults = [...tours]; // Сохраняем изначальный список
            sortTours(document.querySelector(".sort-select").value); // Сортируем при загрузке
        })
        .catch(error => console.error('Ошибка:', error));


    //Авторизация
    const authModal = document.getElementById("authModal");
    const registerModal = document.getElementById("registerModal");
    const loginButton = document.getElementById("loginButton");
    const registerButton = document.getElementById("registerButton");
    const closeButtons = document.querySelectorAll(".close");
    const switchToRegister = document.getElementById("switchToRegister");
    const switchToLogin = document.getElementById("switchToLogin");

    // Вешаем обработчик на кнопку кабинета
    document.getElementById('accountBtn').addEventListener('click', checkAuthState);

    function closeModal(modal) {
        modal.style.display = "none";
        modal.querySelectorAll("input").forEach(input => {
            input.value = "";
            removeError(input);
        });
    }

    closeButtons.forEach(button => {
        button.addEventListener("click", () => {
            closeModal(authModal);
            closeModal(registerModal);
        });
    });

    switchToRegister.addEventListener("click", () => {
        closeModal(authModal);
        registerModal.style.display = "flex";
    });

    switchToLogin.addEventListener("click", () => {
        closeModal(registerModal);
        authModal.style.display = "flex";
    });

    window.addEventListener("click", (event) => {
        if (event.target === authModal) closeModal(authModal);
        if (event.target === registerModal) closeModal(registerModal);
    });

    function showError(input, message) {
        removeError(input);
        const error = document.createElement("div");
        error.classList.add("error-message");
        error.innerText = message;
        input.parentNode.appendChild(error);
        input.classList.add("error-input");
    }

    function removeError(input) {
        const error = input.parentNode.querySelector(".error-message");
        if (error) {
            error.remove();
        }
        input.classList.remove("error-input");
    }

    // Валидация логина и пароля
    function validateLogin(input) {
        const regex = /^[a-zA-Zа-яА-Я0-9.@_-]+$/;
        if (!input.value.trim()) {
            showError(input, "Поле обязательно для заполнения");
            return false;
        } else if (!regex.test(input.value)) {
            showError(input, "Допустимы только латинские буквы, цифры, _ и -");
            return false;
        }
        removeError(input);
        return true;
    }

    function validatePassword(input) {
        if (!input.value.trim()) {
            showError(input, "Поле обязательно для заполнения");
            return false;
        } else if (input.value.length < 6) {
            showError(input, "Пароль должен быть не менее 6 символов");
            return false;
        }
        removeError(input);
        return true;
    }

    function validateEmail(input) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!input.value.trim()) {
            showError(input, "Поле обязательно для заполнения");
            return false;
        } else if (!regex.test(input.value)) {
            showError(input, "Введите корректный email");
            return false;
        }
        removeError(input);
        return true;
    }

    function validateNotEmpty(input) {
        if (!input.value.trim()) {
            showError(input, "Поле обязательно для заполнения");
            return false;
        }
        removeError(input);
        return true;
    }

    loginButton.addEventListener("click", async () => {
        const loginInput = document.getElementById("login");
        const passwordInput = document.getElementById("password");

        const isLoginValid = validateLogin(loginInput);
        const isPasswordValid = validatePassword(passwordInput);

        if (isLoginValid && isPasswordValid) {
            const response = await fetch("http://localhost:3000/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    login: loginInput.value,
                    password: passwordInput.value
                })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                alert("Вход успешен!");
                localStorage.setItem("username", data.user.name);
                checkAuthState();
                window.location.href = "profile.html";
            } else {
                showError(loginInput, data.error);
            }
        }
    });

    // В DOMContentLoaded
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.href === window.location.href) {
            link.classList.add('active');
        }
    });

    registerButton.addEventListener("click", async () => {
        const surnameInput = document.querySelector("#registerModal input[placeholder='Фамилия*']");
        const nameInput = document.querySelector("#registerModal input[placeholder='Имя*']");
        const patronymicInput = document.querySelector("#registerModal input[placeholder='Отчество*']");
        const emailInput = document.querySelector("#registerModal input[placeholder='Почта*']");
        const phoneInput = document.querySelector("#registerModal input[placeholder='Телефон*']");
        const cityInput = document.querySelector("#registerModal input[placeholder='Город*']");
        const loginInput = document.getElementById("login_register");
        const passwordInput = document.getElementById("password_register");

        const isLoginValid = validateLogin(loginInput);
        const isPasswordValid = validatePassword(passwordInput);
        const isEmailValid = validateEmail(emailInput);
        const isSurnameValid = validateNotEmpty(surnameInput);
        const isNameValid = validateNotEmpty(nameInput);

        console.log("isLoginValid:", isLoginValid);
        console.log("isPasswordValid:", isPasswordValid);
        console.log("isEmailValid:", isEmailValid);
        console.log("isSurnameValid:", isSurnameValid);
        console.log("isNameValid:", isNameValid);

        if (isLoginValid && isPasswordValid && isEmailValid && isSurnameValid && isNameValid) {
            const response = await fetch("http://localhost:3000/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    surname: surnameInput.value,
                    name: nameInput.value,
                    patronymic: patronymicInput.value || null,
                    email: emailInput.value,
                    phone: phoneInput.value,
                    city: cityInput.value,
                    login: loginInput.value,
                    password: passwordInput.value
                })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                alert("Регистрация успешна!");
                checkAuthState();
                closeModal(registerModal);
                window.location.href = 'profile.html';
            } else {
                showError(loginInput, data.error);
            }
        }
    });

    sortSelect.addEventListener("change", () => {
        sortTours(sortSelect.value);
    });

    const inputs = document.querySelectorAll("input");

    inputs.forEach((input) => {
        // Отключаем валидацию для полей поиска
        if (input.placeholder === "Откуда" || input.placeholder === "Куда" || input.placeholder === "Чел." || input.type === "date" || input.type === "checkbox") {
            input.removeEventListener("input", validateInput);
        } else {
            input.addEventListener("input", () => validateInput(input));
        }
    });

    // Закрытие модального окна
    document.querySelector('#tourDetailsModal .close').addEventListener('click', () => {
        document.getElementById('tourDetailsModal').style.display = 'none';
    });

    document.getElementById('bookTourBtn').addEventListener('click', async () => {
        const token = localStorage.getItem('token');
        if (!token || !currentTour) {
            alert('Для бронирования необходимо авторизоваться!');
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/api/tours/book', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ tourId: currentTour.tour_id })
            });

            // Сначала проверяем статус ответа
            if (!response.ok) {
                // Пытаемся получить текст ошибки
                const errorText = await response.text();
                throw new Error(errorText || 'Неизвестная ошибка сервера');
            }

            // Если статус успешный, парсим JSON
            const data = await response.json();

            alert('Тур успешно забронирован!');
            document.getElementById('tourDetailsModal').style.display = 'none';

            // Обновляем интерфейс
            if (window.location.pathname.includes('profile.html')) {
                await loadBookings();
            } else {
                const goToProfile = confirm('Бронирование успешно! Перейти в профиль?');
                if (goToProfile) window.location.href = 'profile.html';
            }

        } catch (error) {
            console.error('Ошибка:', error);

            // Обработка ошибки авторизации
            if (error.message.includes('401') || error.message.includes('сессия')) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                alert('Сессия истекла. Пожалуйста, войдите снова.');
                window.location.href = 'tours.html';
            } else {
                alert(`Ошибка бронирования: ${error.message}`);
            }
        }
    });
});