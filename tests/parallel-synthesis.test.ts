import { describe, expect, it } from "vitest";
import { synthesizeParagraphsInParallel } from "../lib/parallel-synthesis";

describe("synthesizeParagraphsInParallel", () => {
  it("starts every paragraph immediately, reports completion progress, and preserves source order", async () => {
    const started: number[] = [];
    const progress: number[] = [];
    const resolvers: Array<(value: string) => void> = [];

    const resultPromise = synthesizeParagraphsInParallel(
      ["first", "second", "third"],
      (_, index) => new Promise<string>((resolve) => {
        started.push(index);
        resolvers[index] = resolve;
      }),
      (percent) => progress.push(percent),
    );

    expect(started).toEqual([0, 1, 2]);

    resolvers[2]("url-third");
    resolvers[0]("url-first");
    resolvers[1]("url-second");

    await expect(resultPromise).resolves.toEqual(["url-first", "url-second", "url-third"]);
    expect(progress).toEqual([33, 67, 100]);
  });

  it("handles an empty story without requesting synthesis", async () => {
    const synthesize = () => Promise.resolve("should-not-run");
    await expect(synthesizeParagraphsInParallel([], synthesize)).resolves.toEqual([]);
  });
});
