# Используйте официальный образ Node.js
FROM node:16

# Установите рабочую директорию
WORKDIR /usr/src/app

# Скопируйте package.json и package-lock.json
COPY package*.json ./

# Установите зависимости
RUN npm install

# Скопируйте остальные файлы проекта
COPY . .

# Откройте порт, который будет использоваться приложением
EXPOSE 3001

# Запустите приложение
CMD ["node", "index.js"]