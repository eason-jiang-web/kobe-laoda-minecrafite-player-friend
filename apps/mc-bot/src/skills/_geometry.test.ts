import { test, expect } from "bun:test";
import { connectedComponent } from "./_geometry.js";

test("connectedComponent grabs a straight log column", () => {
  const logs = [
    { x: 0, y: 64, z: 0 },
    { x: 0, y: 65, z: 0 },
    { x: 0, y: 66, z: 0 },
    { x: 0, y: 67, z: 0 },
  ];
  const got = connectedComponent(logs, logs[0]!);
  expect(got.length).toBe(4);
});

test("connectedComponent includes diagonal branches but excludes a far block", () => {
  const trunk = [
    { x: 0, y: 64, z: 0 },
    { x: 0, y: 65, z: 0 },
    { x: 1, y: 66, z: 0 }, // branch, Chebyshev-adjacent to (0,65,0)
  ];
  const far = { x: 20, y: 64, z: 20 }; // a different tree
  const got = connectedComponent([...trunk, far], trunk[0]!);
  expect(got.length).toBe(3);
  expect(got).not.toContainEqual(far);
});

test("connectedComponent respects the max cap", () => {
  const column = Array.from({ length: 30 }, (_, i) => ({ x: 0, y: 64 + i, z: 0 }));
  const got = connectedComponent(column, column[0]!, 10);
  expect(got.length).toBe(10);
});
