// Type-check only: actual execution is separately exercised by mocked handler tests.
declare namespace Deno {
  namespace env { function get(name: string): string | undefined; }
  function serve(handler: (request: Request) => Response | Promise<Response>): void;
}
