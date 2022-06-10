const jest = require('jest');
const jestConfig = require('./jest.config.js');
const NUM_RETRIES = 3;

async function runTestsAndRetry(jestConfig, retriesRemaining) {
  const { results } = await jest.runCLI(jestConfig, ['test']);
  // If there were no failures or we're out of retries, return
  if (!results.numFailedTests && !results.numFailedTestSuites) {
    return Promise.resolve();
  }
  if (retriesRemaining === 1) {
    return Promise.reject(
      new Error('Out of retries. Some tests are still failing.'),
    );
  }

  // Compile a list of the test suites that failed and tell Jest to only run those files next time
  const failedTestPaths = results.testResults
    .filter(
      (testResult) =>
        testResult.numFailingTests > 0 || testResult.failureMessage,
    )
    .map((testResult) => testResult.testFilePath);
  jestConfig.testMatch = failedTestPaths;

  // Decrement retries remaining and retry
  retriesRemaining = retriesRemaining - 1;
  console.log(`Retrying failed tests. ${retriesRemaining} attempts remaining.`);
  return await runTestsAndRetry(jestConfig, retriesRemaining);
}

runTestsAndRetry(jestConfig, NUM_RETRIES);
