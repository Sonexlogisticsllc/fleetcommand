import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseLocalTextDocument } from '../lib/documentExtraction';

async function main() {
  const rateCon = await parseLocalTextDocument(await readFile('scratch/e2e/qa-rate-confirmation.pdf'), 'application/pdf', 'rate_confirmation', 'qa-rate-confirmation.pdf');
  assert.equal(rateCon.engine, 'local_text_review');
  assert.equal(rateCon.loadNumber, 'SNX-QA-001');
  assert.equal(rateCon.brokerName, 'Sonex QA Broker');
  assert.equal(rateCon.pickupCity, 'Cheyenne');
  assert.equal(rateCon.deliveryCity, 'Denver');
  assert.equal(rateCon.pickupDate, '2026-08-12');
  assert.equal(rateCon.deliveryDate, '2026-08-13');
  assert.equal(rateCon.commodity, 'QA palletized freight');
  assert.equal(rateCon.weight, 24_000);
  assert.equal(rateCon.miles, 104);
  assert.equal(rateCon.rate, 1_450);
  assert.equal(rateCon.validationIssues.length, 0);

  const bol = await parseLocalTextDocument(await readFile('scratch/e2e/qa-bol.pdf'), 'application/pdf', 'bol', 'qa-bol.pdf');
  assert.equal(bol.loadNumber, 'SNX-QA-001');
  assert.equal(bol.commodity, 'QA palletized freight');
  assert.equal(bol.weight, 24_000);
  assert.ok(bol.validationIssues.includes('Broker name was not found.'));
  console.log('Document extraction QA passed (rate confirmation and BOL fixtures).');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
