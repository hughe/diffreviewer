---
description: Review code changes with interactive diff viewer
allowed-tools: Bash(diffreviewer:*), Bash(open:*)
---

# Code Review with DiffReviewer

Please help me review my code changes using the diffreviewer tool.

## Workflow

1. Run `diffreviewer` to start the interactive diff review server
2. Capture the URL from stdout (it will be something like `http://localhost:8000`)
3. Open the URL in my browser using `open <URL>`
4. Wait for the `diffreviewer` command to exit (I will provide my review notes in the browser and then close it)
5. When it exits, capture all the notes that are printed to stdout
6. Present the notes to me clearly and ask if I want you to act on any of them

## Expected Output Format

The diffreviewer tool will output notes in this format:

```
================================================================================
# Diff Review Notes

## General Notes

**filename** (Line X):
```
note content here
```

================================================================================
```

If there are no comments, just let me know "No notes found".

If there are notes, present them clearly and offer to help address any issues mentioned.
