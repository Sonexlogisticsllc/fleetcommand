export type DriverPayType = 'per_mile' | 'percentage' | 'flat';

export function calculateDriverLoadPayCents(
  payType: DriverPayType,
  payRate: number,
  loadedMiles: number,
  emptyMiles: number,
  grossRate: number,
  payableAccessorials: number,
) {
  const rateCents = Math.round(payRate * 100);
  const grossCents = Math.round(grossRate * 100);
  let basePayCents = 0;

  if (payType === 'per_mile') {
    basePayCents = Math.round((loadedMiles + emptyMiles) * rateCents);
  } else if (payType === 'percentage') {
    basePayCents = Math.round((grossCents * payRate) / 100);
  } else {
    basePayCents = rateCents;
  }

  return basePayCents + Math.round(payableAccessorials * 100);
}

export function calculateDriverLoadPay(
  payType: DriverPayType,
  payRate: number,
  loadedMiles: number,
  emptyMiles: number,
  grossRate: number,
  payableAccessorials: number,
) {
  return calculateDriverLoadPayCents(payType, payRate, loadedMiles, emptyMiles, grossRate, payableAccessorials) / 100;
}
