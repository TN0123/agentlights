export type PaneScript = {
  cwd: string;
  prompt: string;
  response: string;
  startFrame: number;
  cps: number;
  finishFrame?: number;
};

export const PANES: PaneScript[] = [
  {
    cwd: "~/myapp",
    prompt: "refactor the cache layer to use the new redis client",
    response:
      "The cache layer currently uses ioredis directly. I'll abstract\n" +
      "it behind a CacheClient interface so the new redis client can\n" +
      "drop in without touching call sites.\n\n" +
      "● Reading src/cache/index.ts\n" +
      "● Reading src/cache/redis.ts\n" +
      "● Editing src/cache/index.ts ",
    startFrame: 18,
    cps: 55,
  },
  {
    cwd: "~/parser",
    prompt: "write a unit test for parseHeader",
    response:
      "Added test/parseHeader.test.ts:\n\n" +
      'it("parses a basic header", () => {\n' +
      '  expect(parseHeader("a: b")).toEqual({a: "b"});\n' +
      "});\n\n" +
      "Done.",
    startFrame: 24,
    cps: 50,
    finishFrame: 132,
  },
  {
    cwd: "~/queue",
    prompt: "the queue test on line 42 is flaky, fix it",
    response:
      "Looking at test/queue.test.js:42…\n\n" +
      "The race is between worker.start() and queue.push().\n" +
      "Adding await before the push should serialize them.\n\n" +
      "● Editing test/queue.test.js ",
    startFrame: 30,
    cps: 50,
  },
  {
    cwd: "~/repo",
    prompt: "summarize the diff on this branch",
    response:
      'This branch adds an experimental "snapshot" command:\n\n' +
      "  • bin/cli.js: wire the new subcommand\n" +
      "  • lib/commands/snapshot.js: implementation\n" +
      "  • test/snapshot.test.js: 4 cases covering the\n" +
      "    happy path and two error modes ",
    startFrame: 36,
    cps: 52,
  },
];

export const GLOW_PANE_INDEX = 1;
