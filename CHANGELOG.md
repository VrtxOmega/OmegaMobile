# Changelog

## 1.0.1 - Continuous Improvement Maintenance

### Added
- **Testing:** Implemented `jest` and added unit test suites for `WebSocketService` and `BiometricService`. Created basic test stubs for screens.
- **CI/CD:** Created `.github/workflows/ci.yml` for automated linting and unit testing.
- **Documentation:** Added comprehensive JSDoc comments to public interfaces in `BiometricService` and `WebSocketService`.

### Changed
- **Performance:** Bounded the `pendingMessages` retry queue in `WebSocketService` to 100 items to prevent infinite offline growth and memory leaks.
- **Performance:** Resolved unmount memory leaks by properly stopping `Animated.loop` loops and clearing timers in `HomeScreen` and `AgentScreen`.
- **Security:** Replaced bare `catch (e)` blocks globally with proper console logging to capture structural stack traces.
- **Security:** Replaced hardcoded connection domains and mock biometric keys with explicitly flagged TODO markers and an `env.js` configuration module.
- **Style:** Enforced consistent React Native code style via automated Prettier and ESLint.

### Removed
- Unused dependencies (`@react-native-community/push-notification-ios`, `react-native-biometrics`, `react-native-permissions`, `react-native-push-notification`, `react-native-reanimated`, `react-native-vector-icons`).
