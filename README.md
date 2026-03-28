# ScanCart Extension

ScanCart is packaged here as a loadable Chrome Manifest V3 extension with no build step required.

## What Works In This MVP

- Amazon product page detection
- automatic page analysis for skincare and food
- floating "Scan" quick action button
- side panel as the main experience
- deterministic scoring with ingredient and nutrition logic
- source confidence and transparency
- Open Food Facts enrichment for food when product identity can be matched
- Open Beauty Facts enrichment when barcode data is available
- Gemini-powered explanations and assistant answers when the user adds a Gemini API key
- saved products, local history, and compare mode

## How To Load It

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select the folder: `C:\Users\Esports\Downloads\rohan\project\extension`

## Recommended First Setup

1. Click the ScanCart toolbar icon to open the side panel
2. Open `Settings`
3. Paste a Gemini API key if you want AI explanations and Q&A
4. Toggle your product preferences
5. Visit an Amazon skincare or food product page

## Notes

- This MVP stores settings and history in `chrome.storage.local`
- Gemini is optional at runtime; the rule-based scoring still works without it
- For a production launch, Gemini and external source calls should move behind a backend instead of storing an API key locally
