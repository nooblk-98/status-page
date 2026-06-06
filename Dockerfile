FROM node:20-alpine

# iputils provides a robust `ping` binary for ICMP monitors (needs NET_RAW capability at runtime).
RUN apk add --no-cache iputils

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
