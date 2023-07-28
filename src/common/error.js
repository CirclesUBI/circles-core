import createSymbolObject from '~/common/createSymbolObject';
import createErrorType from '~/common/createErrorType';

export const ErrorCodes = createSymbolObject([
  'FAILED_REQUEST',
  'INSUFFICIENT_FUNDS',
  'INVALID_OPTIONS',
  'INVALID_TRANSFER',
  'SAFE_NOT_FOUND',
  'SAFE_ALREADY_DEPLOYED',
  'TOKEN_NOT_FOUND',
  'TOO_COMPLEX_TRANSFER',
  'TOO_MANY_ATTEMPTS',
  'TRANSFER_NOT_FOUND',
  'UNKNOWN_ERROR',
]);

export default class CoreError extends Error {
  constructor(
    message = 'Unknown error occurred',
    code = ErrorCodes.UNKNOWN_ERROR,
  ) {
    super(message);

    this.name = 'CoreError';

    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error(message).stack;
    }

    this.code = code;
  }
}

export class RequestError extends CoreError {
  constructor(url, body, status) {
    super(
      `Request failed @ ${url} with error ${status}`,
      ErrorCodes.FAILED_REQUEST,
    );

    this.name = 'RequestError';

    this.request = {
      url,
      body,
      status,
    };
  }
}

export class TransferError extends CoreError {
  constructor(message, code, transferData = {}) {
    super(message, code);

    this.name = 'TransferError';
    this.transfer = transferData;
  }
}

export const SafeDeployedError = createErrorType(
  'SafeDeployedError',
  ErrorCodes.SAFE_ALREADY_DEPLOYED,
);
