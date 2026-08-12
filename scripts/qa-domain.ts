import assert from 'node:assert/strict';
import { calculateDriverLoadPayCents } from '../lib/financialEngine';
import { computeLoadFinancials } from '../lib/sonexTypes';

assert.equal(calculateDriverLoadPayCents('per_mile', 0.65, 450, 50, 1_450, 0), 32_500);
assert.equal(calculateDriverLoadPayCents('percentage', 25, 450, 50, 1_450, 0), 36_250);
assert.equal(calculateDriverLoadPayCents('flat', 300, 450, 50, 1_450, 125), 42_500);
assert.equal(calculateDriverLoadPayCents('percentage', 33.33, 0, 0, 999.99, 12.34), 34_564);

assert.deepEqual(computeLoadFinancials(1_450, 104, 10), {
  dispatchFeeAmount: 145,
  carrierNet: 1_305,
  ratePerMile: 13.94,
});
assert.deepEqual(computeLoadFinancials(999.99, 0, 8.5), {
  dispatchFeeAmount: 85,
  carrierNet: 914.99,
  ratePerMile: 0,
});

console.log('Financial domain QA passed (CPM, percentage, flat, accessorial, and cent rounding).');
