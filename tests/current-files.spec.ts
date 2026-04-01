import { test, expect } from '@playwright/test';

test.describe('Current (working directory) files display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3456');
    // Wait for the app to load
    await page.waitForSelector('.monaco-editor', { timeout: 15000 });
  });

  test('selecting CURRENT should show file content on the right side', async ({ page }) => {
    // Wait for initial load
    await page.waitForTimeout(1000);

    // Find and open the range picker to select "current"
    const rangePicker = page.locator('select, [class*="range"], [class*="picker"]').first();

    // Look for a dropdown or button that lets us select CURRENT
    // Check if there's a select element for the "to" commit
    const toSelect = page.locator('select').last();
    if (await toSelect.isVisible()) {
      // Select the CURRENT option
      const options = await toSelect.locator('option').allTextContents();
      console.log('Available options:', options);

      // Find an option that says "current" or "working" (case insensitive)
      const currentOption = options.find(
        (opt) => opt.toLowerCase().includes('current') || opt.toLowerCase().includes('working')
      );
      if (currentOption) {
        await toSelect.selectOption({ label: currentOption });
      }
    }

    // Wait for diff to load after selection
    await page.waitForTimeout(2000);

    // The modified editor (right side) should have content
    const modifiedEditor = page.locator('.modified-in-monaco-diff-editor').first();
    await expect(modifiedEditor).toBeVisible({ timeout: 5000 });

    // Get the view lines in the modified editor - they should not all be empty
    const viewLines = modifiedEditor.locator('.view-line');
    const lineCount = await viewLines.count();
    expect(lineCount).toBeGreaterThan(0);

    // Check that at least some lines have text content
    let hasContent = false;
    for (let i = 0; i < Math.min(lineCount, 10); i++) {
      const text = await viewLines.nth(i).textContent();
      if (text && text.trim().length > 0) {
        hasContent = true;
        break;
      }
    }
    expect(hasContent).toBe(true);
  });

  test('API returns file content for working directory files', async ({ page }) => {
    // First get the diff with CURRENT to find a file with all-zeros hash
    const diffResponse = await page.evaluate(async () => {
      const baseResp = await fetch('./api/base-commit');
      const { base_commit } = await baseResp.json();

      const diffResp = await fetch(`./api/diff?from=${base_commit}&to=CURRENT`);
      return diffResp.json();
    });

    console.log('Diff files:', JSON.stringify(diffResponse, null, 2));

    // If there are changed files, verify we can fetch their content
    if (Array.isArray(diffResponse) && diffResponse.length > 0) {
      const file = diffResponse[0];
      console.log('Testing file:', file.path, 'new_hash:', file.new_hash);

      // Fetch the file content using the new_hash
      const content = await page.evaluate(async (f: any) => {
        const params = new URLSearchParams();
        params.append('hash', f.new_hash);
        if (f.new_hash === '0000000000000000000000000000000000000000') {
          params.append('path', f.path);
        }
        const resp = await fetch(`./api/file-content?${params.toString()}`);
        return resp.text();
      }, file);

      console.log('Content length:', content.length);
      // Working directory files should have content (not empty)
      if (file.new_hash === '0000000000000000000000000000000000000000') {
        expect(content.length).toBeGreaterThan(0);
      }
    }
  });
});
