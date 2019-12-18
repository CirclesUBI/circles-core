import createSymbolObject from '~/common/createSymbolObject';

export const ErrorCodes = createSymbolObject([
  'FAILED_REQUEST',
  'INVALID_OPTIONS',
  'NETWORK_NO_PATH',
  'NETWORK_TOO_SMALL',
  'SAFE_NOT_FOUND',
  'TOKEN_NOT_FOUND',
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
