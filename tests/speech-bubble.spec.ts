import { test, expect } from '@playwright/test';

test.describe('Speech Bubble Glyph', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the DiffReviewer running on localhost:3456
    await page.goto('http://localhost:3456');

    // Wait for Monaco editor to load
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });
  });

  test('speech bubble glyph should appear when hovering over a line', async ({ page }) => {
    // Wait a bit for the editor to fully initialize
    await page.waitForTimeout(2000);

    // Find a line in the modified editor (right side of diff)
    const modifiedEditor = page.locator('.modified-in-monaco-diff-editor').first();
    await expect(modifiedEditor).toBeVisible();

    // Get the first line content area
    const firstLine = modifiedEditor.locator('.view-line').first();
    await expect(firstLine).toBeVisible();

    // Hover over the first line
    await firstLine.hover();

    // Wait a moment for the glyph to appear
    await page.waitForTimeout(500);

    // Check if the speech bubble glyph is visible
    // The glyph should have the class 'comment-glyph-decoration' and 'hover-visible'
    const speechBubble = page.locator('.comment-glyph-decoration.hover-visible').first();

    // The glyph should be visible (opacity: 1)
    await expect(speechBubble).toBeVisible();

    // Verify it has the speech bubble emoji content
    const glyphContent = await speechBubble.evaluate((el) =>
      window.getComputedStyle(el, ':before').content
    );

    // The content should be the speech bubble emoji
    expect(glyphContent).toContain('💬');
  });

  test('clicking the speech bubble should open the note box', async ({ page }) => {
    // Wait a bit for the editor to fully initialize
    await page.waitForTimeout(2000);

    // Find and hover over a line to make the glyph visible
    const modifiedEditor = page.locator('.modified-in-monaco-diff-editor').first();
    const firstLine = modifiedEditor.locator('.view-line').first();
    await firstLine.hover();

    // Wait for the glyph to appear
    await page.waitForTimeout(500);

    // Click the glyph margin area
    const glyphMargin = page.locator('.margin-view-overlays').first();
    await glyphMargin.click({ position: { x: 8, y: 10 } });

    // The note box should appear
    const noteBox = page.locator('.note-box');
    await expect(noteBox).toBeVisible();

    // It should have the title "Add note"
    await expect(page.locator('.note-box-title')).toHaveText('Add note');

    // It should have a textarea
    await expect(page.locator('.note-textarea')).toBeVisible();
  });

  test('speech bubble should disappear when mouse leaves the line', async ({ page }) => {
    // Wait a bit for the editor to fully initialize
    await page.waitForTimeout(2000);

    // Find a line in the modified editor
    const modifiedEditor = page.locator('.modified-in-monaco-diff-editor').first();
    const firstLine = modifiedEditor.locator('.view-line').first();

    // Hover over the line
    await firstLine.hover();
    await page.waitForTimeout(500);

    // Glyph should be visible
    await expect(page.locator('.comment-glyph-decoration.hover-visible').first()).toBeVisible();

    // Move mouse away from the editor
    await page.mouse.move(0, 0);
    await page.waitForTimeout(500);

    // Glyph should no longer be visible
    const glyphCount = await page.locator('.comment-glyph-decoration.hover-visible').count();
    expect(glyphCount).toBe(0);
  });
});
