# Building DiffReviewer

## Expected Build Error

**Note:** Go will show this error before building:
```
pattern all:web: no matching files found
```

This is expected! The `cmd/diffreviewer/web/` directory is created during the build process.

## Build Steps

1. **Build Frontend** (creates the web/ directory):
   ```bash
   make build-frontend
   ```

2. **Copy web assets** (required for embedding):
   ```bash
   cd web && rm -rf ../cmd/diffreviewer/web && cp -r dist ../cmd/diffreviewer/web
   ```

3. **Build Backend** (embeds the web/ directory):
   ```bash
   make build-backend
   ```

Or simply run:
```bash
make build
```

This will execute all steps in order.

## Why This Approach?

The web assets are embedded into the Go binary at compile time using `//go:embed`.
The build process ensures the assets are generated and copied before the Go build runs.
