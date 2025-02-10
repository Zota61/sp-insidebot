FROM node:18.10.0

RUN apt-get update && apt-get -y install netcat && apt-get clean

WORKDIR /app

COPY . /app/


RUN npm install