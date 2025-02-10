FROM node:16.10.0

RUN apt-get update && apt-get -y install netcat && apt-get clean

WORKDIR /app

COPY . /app/

RUN npm install