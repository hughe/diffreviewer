.PHONY: all build build-frontend build-backend clean dev install test

all: build

build: build-frontend build-backend

build-frontend:
	@echo "Building frontend..."
	cd web && npm install && npm run build

build-backend: build-frontend
	@echo "Copying dist to cmd/diffreviewer/web-dist..."
	rm -rf cmd/diffreviewer/web-dist
	cp -r web/dist cmd/diffreviewer/web-dist
	@echo "Building backend..."
	go build -o bin/diffreviewer ./cmd/diffreviewer

clean:
	@echo "Cleaning..."
	rm -rf bin web/dist web/node_modules

dev:
	@echo "Starting development server..."
	cd web && npm install && npm run dev

install: build
	@echo "Installing diffreviewer..."
	cp bin/diffreviewer /usr/local/bin/

test:
	@echo "Running tests..."
	go test -v ./...
