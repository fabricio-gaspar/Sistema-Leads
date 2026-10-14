export {};

const retired = () => new Response(JSON.stringify({ ok: false, error: 'legacy_provider_retired' }), {
  status: 410,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

// Kept only to retire the previously published callback endpoint safely.
Deno.serve(retired);
