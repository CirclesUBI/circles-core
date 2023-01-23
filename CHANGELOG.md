# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
