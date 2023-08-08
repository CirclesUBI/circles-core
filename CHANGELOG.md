# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.7.0] - 2023-08-08

### Added

- Add news module [#211] https://github.com/CirclesUBI/circles-core/pull/211

## [4.6.0] - 2023-07-31

### Changed

- Update graph limit query from 100 to 1000 [#215](https://github.com/CirclesUBI/circles-core/pull/215)

### Added

- Added get mutual activity [#213](https://github.com/CirclesUBI/circles-core/pull/213)

## [4.5.0] - 2023-06-14

### Changed

- Update to Node v16 [#199](https://github.com/CirclesUBI/circles-core/pull/199)
- Update dependencies [#199](https://github.com/CirclesUBI/circles-core/pull/199)

### Added

- Run lint before commit [#197](https://github.com/CirclesUBI/circles-core/pull/197)

## [4.4.2] - 2023-05-03

### Fixed

- Subgraph balances limit increase to 1000 results per pagination [#194](https://github.com/CirclesUBI/circles-core/pull/194)

## [4.4.1] - 2023-05-02

### Fixed

- Increase loop default retries from 10 to 30 [#192](https://github.com/CirclesUBI/circles-core/pull/192)

## [4.4.0] - 2023-05-02

### Changed

- Increase user trust limit value from 50% to 100% [#181](https://github.com/CirclesUBI/circles-core/pull/181)

## [4.3.1] - 2023-04-18

### Fixed

- Increase default delay retry timing for loop utils method [#186](https://github.com/CirclesUBI/circles-core/pull/186)

## [4.3.0] - 2023-04-18

### Reverted

- Temporary revert user trust limit value to 50%

## [4.2.0] - 2023-04-12

### Changed

- Increase user trust limit value from 50% to 100% [#181](https://github.com/CirclesUBI/circles-core/pull/181)

## [4.1.0] - 2023-03-31

### Fixed

- Fix loop functionality for waiting [#173](https://github.com/CirclesUBI/circles-core/pull/173)

### Added

- Add `loop` method to core utils module [#173](https://github.com/CirclesUBI/circles-core/pull/173)
- Add pathfinder max transfer steps as core option [#180](https://github.com/CirclesUBI/circles-core/pull/180)

## [4.0.1] - 2023-03-29

### Fixed

- Fix call to `randomUUID()` function [#179](https://github.com/CirclesUBI/circles-core/pull/179)

## [4.0.0] - 2023-03-28

### Changed

- New feature: the core can request the pathfinder service API instead of the `circles-api`. The pathfinder service is used by default. Methods affected: `core.token.transfer` and `core.token.findTransitiveTransfer`. New parameters for instantiating the core are needed: `pathfinderType` (`cli` or `server`, by defalut `server`) and `pathfinderServiceEndpoint`. Use `randomUUID()` for the pathfinder server requests ids [#165](https://github.com/CirclesUBI/circles-core/pull/165) [#169](https://github.com/CirclesUBI/circles-core/pull/169) [#175](https://github.com/CirclesUBI/circles-core/pull/175)
- Update all dependencies [#171](https://github.com/CirclesUBI/circles-core/pull/171)

## [3.2.1] - 2023-02-11

### Changed

- Use `isCRCVersion` option in `token.deploy` to allow execution of txs with Safes on version `v1.1.1+Circles` [#162](https://github.com/CirclesUBI/circles-core/pull/162)

## [3.2.0] - 2023-01-23

### Added

- Add functionality to customize the number of hops for path-finding requests to the api. The number of hops is now an optional parameter with the default set to 3. [#153](https://github.com/CirclesUBI/circles-core/pull/153)

## [3.1.3] - 2022-12-02

### Removed

- Remove multisend functionality [#149](https://github.com/CirclesUBI/circles-core/pull/149)

### Fixed

- Update GH Actions dependencies [#149](https://github.com/CirclesUBI/circles-core/pull/149)

## [3.1.2] - 2022-12-01

### Fixed

- Set operation type: number [#147](https://github.com/CirclesUBI/circles-core/pull/147)

## [3.1.1] - 2022-11-30

### Changed

- Add MultiSend contract and use it for update Safe version [#146](https://github.com/CirclesUBI/circles-core/pull/146)

## [3.1.0] - 2022-11-29

### Changed

- Update `circles-contracts` and use GnosisSafeL2 [#145](https://github.com/CirclesUBI/circles-core/pull/145)

## [3.0.0] - 2022-11-23

### Added

- Add method to update Safe to the last version (v1.3.0) by changing the the Master Copy [#141](https://github.com/CirclesUBI/circles-core/pull/141)
- Add method to get the Safe version [#141](https://github.com/CirclesUBI/circles-core/pull/141)

### Changed

- Use latest Safe contracts (Safe v1.3.0) by default [#141](https://github.com/CirclesUBI/circles-core/pull/141)
- Use Node v14 for tests [#143](https://github.com/CirclesUBI/circles-core/pull/143)
- Update dependencies
- Update contributors

### Fixed

- Token test updated to becompatible with the new [`circles-api`](https://github.com/CirclesUBI/circles-api/pull/123) that uses csv export and new pathfinder with `--flowcsv` tag [#133](https://github.com/CirclesUBI/circles-core/pull/133)

## [2.12.0] - 2022-08-09

## Added

- Add user methods: update user data, and get email [#130](https://github.com/CirclesUBI/circles-core/pull/130)

### Changed

- Update Contributors in package.json [#129](https://github.com/CirclesUBI/circles-core/pull/129)
- Update CODEOWNERS [#132](https://github.com/CirclesUBI/circles-core/pull/132)

## [2.11.2] - 2022-07-08

### Changed

- Update dependencies and use node v14 [#127](https://github.com/CirclesUBI/circles-core/pull/127)

## [2.11.1] - 2022-06-13

### Fixed

- Fix set default value for databaseSource [#119](https://github.com/CirclesUBI/circles-core/pull/119)

## [2.11.0] - 2022-06-06

### Added

- Add method to update transfer steps [#116](https://github.com/CirclesUBI/circles-core/pull/116)

## [2.10.12] - 2022-05-12

### Fixed

- Add default value for `databaseSource` constructor param [#112](https://github.com/CirclesUBI/circles-core/pull/112) [#115](https://github.com/CirclesUBI/circles-core/pull/115)
- Update dependencies [#114](https://github.com/CirclesUBI/circles-core/pull/114)

## [2.10.11] - 2022-03-25

### Fixed

- Add possibility to choose data layer[#105](https://github.com/CirclesUBI/circles-core/pull/105)
- Update tests
- Fix Git Actions

## [2.10.10] - 2021-06-02

### Fixed

- Fix trust limits as an organization. [#83](https://github.com/CirclesUBI/circles-core/pull/83)
- Wait for trust connection before prefunding organization. [#82](https://github.com/CirclesUBI/circles-core/pull/82)

## [2.10.9] - 2021-04-21

### Changed

- Increase transfer step limit. [#65176c1](https://github.com/CirclesUBI/circles-core/commit/65176c1f2fdd82f98877427ac398a1568bc2ad8f)
