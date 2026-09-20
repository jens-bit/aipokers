// Forward a browser request to this test's isolated native backend. The path,
// query, method, authentication headers and request body stay unchanged.
export async function forwardNative(route, backend) {
  const url = new URL(route.request().url());
  // BUG-286: responses are unmodified, so let the browser own their lifetime.
  // fetch()+fulfill() can race unrouteAll(wait): one completed callback removes
  // interception while another still waits for its response, double-handling it.
  await route.continue({ url: `${backend}${url.pathname}${url.search}` });
}
