export default function createErrorType(name, code, init) {
  function E(message) {
    if (!Error.captureStackTrace) this.stack = new Error().stack;
    else Error.captureStackTrace(this, this.constructor);
    this.message = message;
    this.code = code;
    init && init.apply(this, arguments);
  }
  E.prototype = new Error();
  E.prototype.name = name;
  E.prototype.constructor = E;
  return E;
}
