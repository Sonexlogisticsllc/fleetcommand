# Sonex Document Extraction

## Production engine

Sonex uses Google Document AI Custom Extractor with a Gemini foundation model for rate confirmations and BOLs. This provider-backed model handles scanned documents and vendor layout variation. The portal keeps the editable review panel and validates route, dates, rate, mileage, and weight before any save.

## Required Vercel environment variables

```text
GOOGLE_DOCUMENT_AI_PROJECT_ID=
GOOGLE_DOCUMENT_AI_LOCATION=us
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=
GOOGLE_DOCUMENT_AI_PROCESSOR_VERSION=
GOOGLE_DOCUMENT_AI_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

Keep the service-account JSON secret in Vercel only. Never commit it or expose it as a `NEXT_PUBLIC_` variable.

## Custom Extractor schema

Use these exact field names:

```text
load_number, broker_name, broker_contact, broker_phone, broker_email, broker_mc,
pickup_facility, pickup_address, pickup_city, pickup_state, pickup_zip, pickup_date,
pickup_time, pickup_appointment_number,
delivery_facility, delivery_address, delivery_city, delivery_state, delivery_zip,
delivery_date, delivery_time, delivery_appointment_number,
commodity, weight, miles, rate
```

Use `Extract` fields and describe rate as the carrier compensation, not broker margin.

## Dataset discipline

1. Start with 20 representative, redacted rate confirmations and 20 BOLs.
2. Reserve 20% of every document type as a test set; never train on it.
3. Save only supervisor-verified dispatcher corrections as labels.
4. Fine-tune after 30-50 reviewed samples per variable document type.
5. Promote a version only after held-out results improve on load number, stops, dates, and rate.

Every result remains review-required; model confidence is evidence, not proof. Run `npm run qa:extraction` before deploying parser changes.

## Local fallback

Without the Google variables, local development parses text-based PDFs only and identifies itself as `local_text_review`. It is deliberately conservative and is not production OCR.
