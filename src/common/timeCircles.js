import Web3 from 'web3';
import dayjs from 'dayjs';

// File based on:
// https://github.com/circles-pink/circles-pink/blob/main/pkgs/ts/@circles-pink/web-client/src/onboarding/utils/timeCircles.ts
// https://github.com/circlesland/api-server/blob/main/src/utils/timeCircles.ts

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

// type Currency = 'CIRCLES' | 'TIME-CIRCLES' | 'EURO';
// type Conversion = 'FROM-TIME-CIRCLES' | 'TO-TIME-CIRCLES';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const oneYearInSeconds = 31557600; // This is 365,25 Days in seconds.
const oneDayInSeconds = 86400;
const day0Unix = dayjs('2020-10-15T00:00:00.000Z').unix();

const baseCirclesPerDayValue = 8;
let previousCirclesPerDayValue = 8;

// -----------------------------------------------------------------------------
// Util
// -----------------------------------------------------------------------------

const circlesValue = (x) => x * 1.07;
const lerp = (x, y, a) => x * (1 - a) + y * a;

function getBaseCirclesPerDayValue(yearsSince) {
  let circlesPerDayValue = baseCirclesPerDayValue;
  for (let index = 0; index < yearsSince; index++) {
    previousCirclesPerDayValue = circlesPerDayValue;
    circlesPerDayValue = circlesValue(circlesPerDayValue);
  }
  return circlesPerDayValue;
}

// -----------------------------------------------------------------------------
// Circles / Timecircles conversion
// -----------------------------------------------------------------------------

export function convertTimeCirclesToCircles(amount, date) {
  const dateTime = date ? dayjs(date) : dayjs();
  return mapCircles(amount, dateTime, 'FROM-TIME-CIRCLES');
}

export function convertCirclesToTimeCircles(amount, date) {
  const dateTime = date ? dayjs(date) : dayjs();
  return mapCircles(amount, dateTime, 'TO-TIME-CIRCLES');
}

const mapCircles = (amount, dateTime, type) => {
  const transactionDateUnix = dayjs(dateTime).unix();
  const daysSinceDay0Unix = (transactionDateUnix - day0Unix) / oneDayInSeconds;
  const dayInCurrentCycle = daysSinceDay0Unix % 365.25;
  const yearsSince = (transactionDateUnix - day0Unix) / oneYearInSeconds;
  const perDayValue = getBaseCirclesPerDayValue(yearsSince);

  switch (type) {
    case 'FROM-TIME-CIRCLES':
      return parseFloat(
        (
          (amount / 24) *
          lerp(
            previousCirclesPerDayValue,
            perDayValue,
            dayInCurrentCycle / 365.25,
          )
        ).toFixed(12),
      );
    case 'TO-TIME-CIRCLES':
      return (
        (amount /
          lerp(
            previousCirclesPerDayValue,
            perDayValue,
            dayInCurrentCycle / 365.25,
          )) *
        24
      );
  }
};

// -----------------------------------------------------------------------------
// Balance
// -----------------------------------------------------------------------------

export function displayBalance(amount, currency = 'TIME-CIRCLES', date) {
  const dateTime = date ? dayjs(date) : dayjs();
  return mapCurrency(amount, dateTime, currency).toFixed(2);
}

const mapCurrency = (amount, dateTime, type) => {
  switch (type) {
    case 'CIRCLES':
      return Number.parseFloat(Web3.utils.fromWei(amount, 'ether'));
    case 'TIME-CIRCLES':
      return convertCirclesToTimeCircles(
        Number.parseFloat(Web3.utils.fromWei(amount, 'ether')),
        dateTime.toString(),
      );
    case 'EURO':
      return (
        convertCirclesToTimeCircles(
          Number.parseFloat(Web3.utils.fromWei(amount, 'ether')),
          dateTime.toString(),
        ) / 10
      );
  }
};
