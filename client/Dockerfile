# Базовый образ для Node.js
FROM node:16

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json для установки зависимостей
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем остальные файлы приложения
COPY . .

# Открываем порт для встроенного сервера React (по умолчанию 3000)
EXPOSE 3000

# Запускаем React-приложение
CMD ["npm", "start"]