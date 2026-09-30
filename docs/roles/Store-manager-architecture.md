# Store Manager Architecture

Owners:
- Adrian
- Abish

Platform:
```text
Next.js responsive web
```

Flow:
```text
Orders
-> Create Order
-> Confirmation
-> Delivery Status
-> Deferred Notice
-> Receipt Confirmation
```

Branches:
```text
feature/store-orders
feature/store-create-order
feature/store-confirmation
feature/store-delivery-status
feature/store-deferral
feature/store-receipt
```

Commits:
```text
feat(store): add orders page
feat(store): add create order form
feat(store): add cutoff-aware confirmation
feat(store): add delivery status timeline
feat(store): add deferred order notice
feat(store): add receipt confirmation
test(store): cover store workflow
```

Definition of Done:
- order submits
- cutoff clear
- status visible
- deferral reason visible
- receipt works
