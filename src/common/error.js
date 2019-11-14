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
    ...args
  ) {
    super(message, ...args);

    this.code = code;
  }
}

export class RequestError extends CoreError {
  constructor(url, body, status, ...args) {
    super(
      `Request failed @ ${url} with error ${status}`,
      ErrorCodes.FAILED_REQUEST,
      ...args,
    );

    this.request = {
      url,
      body,
      status,
    };
  }
}
