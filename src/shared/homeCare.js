// One real fridge trip takes 4.8 seconds. Observe more slowly than that;
// multiple devices share the server's last accepted item timestamp.
export const HOME_CARE_INTERVAL_MS = 6000;
export const HOME_ITEM_TRIP_MS = 4800;
export const HOME_OBSERVE_HEARTBEAT_MS = 5000;
export const HOME_OBSERVE_LEASE_MS = 15_000;
