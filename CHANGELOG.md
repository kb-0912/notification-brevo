# Changelog

## [2.1.1] - 2026-03-09

### Fixed

- **Critical: Abandoned cart always using discount template**. `input._useDiscountTemplate` is a Medusa workflow proxy object — always truthy in JS ternary. Used `transform()` to resolve the actual runtime boolean value before selecting template. This caused ALL abandoned cart emails to use `cart.abandoned.discount` instead of `cart.abandoned`.

## [2.1.0] - 2026-03-09

### Fixed

- **Country exclusion for abandoned cart**: Previously skipped ALL emails for excluded countries. Now only skips coupon creation and discount email — basic reminder emails are still sent.
- **Country exclusion for welcome promotion**: Refactored `autoCreateAndSendPromotionStep` to use `Modules.CUSTOMER` → `retrieveCustomer()` directly instead of relying on Medusa workflow proxy for phone data. Matches the proven pattern from the old subscriber. Supports both `+84` and `84` phone prefix formats.
- **Multi-language email locale**: `resolveLocaleStep` previously only checked `customer.metadata.preferred_locale` which is not set at registration time → always fell back to default English template.

### Added

- **Phone prefix → locale inference**: Automatic locale detection from customer phone number (e.g. `+84` → `vi`, `+82` → `ko`, `+86` → `zh`). Applied as fallback when `preferred_locale` metadata is not set.
- **Country code → locale inference**: Fallback locale detection from shipping address country code (e.g. `vn` → `vi`).
- Updated all 6 email workflows to pass `phone` and `countryCode` to `resolveLocaleStep`: `send-customer-created`, `send-order-confirmation`, `send-shipment-confirmation`, `send-order-canceled`, `send-order-delivered`, `send-abandoned-cart`.

### Changed

- `autoCreateAndSendPromotionStep` now takes only `customerId` and `locale` as input, loading all customer data internally from the database.
- Phone prefix matching now sorts by prefix length descending to avoid mismatches (e.g. `+886` matches before `+8`).
- Campaign name now includes customer phone for better identification in Medusa admin.
