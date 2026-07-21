install:
	npm ci
	npm ci --prefix frontend

build:
	npm run build

start:
	npm start

start-frontend:
	npm start --prefix frontend

.PHONY: install build start start-frontend
