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

class ExtendableError extends Error {
  constructor(message) {
    super(message);

    this.name = this.constructor.name;

    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error(message).stack;
    }
  }
}

export default class CoreError extends ExtendableError {
  constructor(
    message = 'Unknown error occurred',
    code = ErrorCodes.UNKNOWN_ERROR,
  ) {
    super(message);

    this.code = code;
  }
}

export class RequestError extends CoreError {
  constructor(url, body, status) {
    super(
      `Request failed @ ${url} with error ${status}`,
      ErrorCodes.FAILED_REQUEST,
    );

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

    this.transfer = transferData;
  }
}
