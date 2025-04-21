FROM node as builder

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

COPY . .

RUN npm install
RUN npm run build

RUN ls

FROM node:slim

ENV NODE_ENV production
USER node

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

COPY --from=builder /usr/src/app/dist ./dist

# Copy env
COPY .env .env

EXPOSE 3001
CMD [ "node", "dist/index.js" ]