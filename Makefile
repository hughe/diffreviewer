.PHONY: all build build-frontend build-backend clean dev install test

all: build

build: build-frontend build-backend

build-frontend:
	@echo "Building React frontend..."
	cd web-react && npm install && npm run build

build-backend: build-frontend
	@echo "Copying dist to cmd/diffreviewer/web-dist..."
	rm -rf cmd/diffreviewer/web-dist
	cp -r web-react/dist cmd/diffreviewer/web-dist
	@echo "Building backend..."
	go build -o bin/diffreviewer ./cmd/diffreviewer

clean:
	@echo "Cleaning..."
	rm -rf bin web-react/dist web-react/node_modules web/dist web/node_modules

dev:
	@echo "Starting React development server..."
	cd web-react && npm install && npm run dev

install: build
	@echo "Installing diffreviewer..."
	cp bin/diffreviewer /usr/local/bin/

test:
	@echo "Running tests..."
	go test -v ./...

builder-image:
	cd docker && docker build . -t diffreviewer-giverny-base
