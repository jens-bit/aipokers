# Dependency Audit Notes (PLT-3)

Run: `npm audit` at repo root and `cd client && npm audit`.
Date: 2026-08-29. **Report only — nothing upgraded in this tree.**

---

## Root (server) — 4 vulnerabilities

### 1. `ws` ^8.18.0 — **HIGH**

| Field | Detail |
|---|---|
| Installed | `ws` ^8.18.0 (direct dep) |
| Advisory 1 | GHSA-96hv-2xvq-fx4p — Memory exhaustion DoS from tiny fragments / data chunks (HIGH, CVSS 7.5) |
| Advisory 2 | GHSA-58qx-3vcg-4xpx — Uninitialized memory disclosure (MODERATE, CVSS 4.4) |
| Fix range | `>=8.21.0` |
| Upgrade type | **Safe minor bump** — 8.18 → 8.21 is semver-compatible |
| Recommendation | **Upgrade soon.** `ws` is the WebSocket server that every player connection uses. The DoS advisory (7.5) is remotely exploitable with no auth. Run `npm install ws@^8.21.0` and re-run the engine tests. |

### 2. `qs` (indirect via `express`) — MODERATE

| Field | Detail |
|---|---|
| Installed | `qs` 6.11.x (indirect via `express@^4.21.1`) |
| Advisory | GHSA-q8mj-m7cp-5q26 — `qs.stringify` crashes with TypeError on null/undefined in comma-format arrays with `encodeValuesOnly` (MODERATE, CVSS 5.3) |
| Fix range | `qs >=6.15.2` |
| Upgrade type | **Safe minor bump** — fixed by upgrading `express` to `>=4.22.2` which pulls in a patched `qs` |
| Recommendation | Upgrade `express` to `^4.22.2` (or latest 4.x). Run `npm install express@^4.22.2`. |

### 3. `body-parser` (indirect via `express`) — LOW

| Field | Detail |
|---|---|
| Installed | `body-parser` <1.20.6 (indirect via `express`) |
| Advisory | GHSA-v422-hmwv-36x6 — Invalid `limit` value silently disables body-size enforcement (LOW, CVSS 3.7) |
| Fix range | `body-parser >=1.20.6` |
| Upgrade type | **Safe minor bump** — also fixed by the `express` upgrade above (`express@4.22+` ships with `body-parser@1.20.6+`) |
| Recommendation | Resolved automatically by the `express` upgrade in item 2 above. No separate action needed. |

---

## Client — 5 vulnerabilities

### 4. `vite` ^5.4.10 — **HIGH** (3 advisories)

| Field | Detail |
|---|---|
| Installed | `vite` ^5.4.10 (direct devDep) |
| Advisory 1 | GHSA-fx2h-pf6j-xcff — `server.fs.deny` bypass on Windows alternate paths (HIGH, CVSS 7.5) |
| Advisory 2 | GHSA-4w7w-66w2-5vf9 — Path traversal in optimised deps `.map` handling (MODERATE) |
| Advisory 3 | GHSA-v6wh-96g9-6wx3 — NTLMv2 hash disclosure via UNC paths on Windows via `launch-editor` (MODERATE) |
| Fix | `npm audit fix` in `client/` suggests `vite@8.2.2` |
| Upgrade type | **Breaking major** — 5.x → 8.x. Vite 6 and 7 are also in the fix range; a 5→6 bump may be less disruptive but is still semver-major. |
| Recommendation | The dev-server advisories (items 1 and 3) are dev-only risks — they only apply when running `vite dev`, not in production builds. The `.map` path-traversal (item 2) affects the build output and is more relevant. **Upgrade Vite to 6.x first** (less churn than 8.x). Test the full build (`npm run build:client`) after. Coordinate with the client-side feature tree. |

### 5. `esbuild` (indirect via `vite`) — MODERATE

| Field | Detail |
|---|---|
| Installed | `esbuild` <=0.24.2 (indirect dep of `vite`) |
| Advisory | GHSA-67mh-4wv8-2f99 — Dev server proxies any request to any origin (MODERATE, CVSS 5.3) |
| Fix | Resolved by the Vite upgrade above |
| Recommendation | Resolved automatically by the `vite` upgrade in item 4. Dev-only risk. |

### 6. `postcss` (indirect via `vite`) — **HIGH** (2 advisories)

| Field | Detail |
|---|---|
| Installed | `postcss` <=8.5.22 (indirect dep of `vite`) |
| Advisory 1 | GHSA-r28c-9q8g-f849 — Path traversal in `sourceMappingURL` auto-loading, arbitrary `.map` file disclosure (HIGH, CVSS 7.5) |
| Advisory 2 | GHSA-fxqj-rqcc-2cmp — Incomplete fix of GHSA-6g55-p6wh-862q (MODERATE) |
| Fix | `postcss >=8.5.23`; also resolved by the Vite upgrade |
| Recommendation | Resolved automatically by the `vite` upgrade (Vite 6+ ships with a patched postcss). If not upgrading Vite yet, `npm install postcss@^8.5.23 -D` in `client/` works standalone. |

### 7. `nanoid` (indirect via `vite`/`postcss`) — **HIGH** (2 advisories)

| Field | Detail |
|---|---|
| Installed | `nanoid` <=3.3.17 (indirect dep) |
| Advisory 1 | GHSA-28wg-ghj8-5hjv — Non-secure generators can loop indefinitely with negative size (HIGH, CVSS 5.9) |
| Advisory 2 | GHSA-2v37-7h3g-55p8 — Custom generators loop indefinitely when size is zero (HIGH, CVSS 5.9) |
| Fix | `nanoid >=3.3.18`; `npm install nanoid@^3.3.18 -D` in `client/` |
| Upgrade type | **Safe minor bump** |
| Recommendation | Upgrade standalone (`npm install nanoid@^3.3.18 -D`) or let the Vite upgrade pull in a fixed version. Low actual risk unless nanoid is called with attacker-controlled sizes. |

### 8. `@babel/core` (indirect, dev-only) — LOW

| Field | Detail |
|---|---|
| Installed | `@babel/core` <=7.29.0 (indirect dev dep) |
| Advisory | GHSA-4x5r-pxfx-6jf8 — Arbitrary file read via `sourceMappingURL` comment (LOW, CVSS 3.2) |
| Fix | `@babel/core >=7.30.0` |
| Upgrade type | **Safe minor bump** |
| Recommendation | Low severity, dev-only, build-tool context. Fix as part of a general devDep bump; not urgent. |

---

## Priority order

1. **`ws` >=8.21.0** (root) — remotely exploitable DoS against the WebSocket server. Upgrade first.
2. **`express` >=4.22.2** (root) — fixes `qs` + `body-parser` together. One command.
3. **`vite` 6.x** (client) — fixes 5 of the 5 client advisories. Coordinate with frontend work; needs build regression testing.
4. **`nanoid` >=3.3.18** (client) — safe standalone bump if Vite upgrade is delayed.
5. **`@babel/core`** — low severity, defer to a future devDep sweep.
