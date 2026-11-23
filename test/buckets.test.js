import { test } from "node:test";
import assert from "node:assert/strict";
import { nameFor, mergeBuckets, missingBuckets } from "../src/buckets.js";

const drives = [{ id: "DRVAAA", name: "alpha-drive" }, { id: "DRVBBB", name: "beta-drive" }];
const doclibs = [{ id: "DLBCCC", name: "team-library" }];

test("autoBuckets 关闭时只用显式配置", () => {
  const r = mergeBuckets([{ name: "personal", driveId: "DRVAAA" }], { drives, doclibs }, false);
  assert.deepEqual(r.buckets.map((b) => b.name), ["personal"]);
  assert.deepEqual(r.added, []);
});

test("autoBuckets 打开时补上未配置的盘，名字从 id 派生且小写", () => {
  const r = mergeBuckets([{ name: "personal", driveId: "DRVAAA" }], { drives, doclibs }, true);
  assert.deepEqual(r.added, [
    { name: "user-drvbbb", driveId: "DRVBBB" },
    { name: "doclib-dlbccc", driveId: "DLBCCC" },
  ]);
  assert.deepEqual(r.buckets.map((b) => b.name), ["personal", "user-drvbbb", "doclib-dlbccc"]);
});

test("显式名字优先，重复 id 不会被重复注册", () => {
  const r = mergeBuckets([{ name: "cold", driveId: "DLBCCC" }], { drives: [], doclibs }, true);
  assert.equal(r.added.length, 0);
  assert.equal(r.buckets[0].name, "cold");
});

test("名字撞车时加后缀，不会覆盖已配置的 bucket", () => {
  const r = mergeBuckets([{ name: "doclib-dlbccc", driveId: "other" }], { drives: [], doclibs }, true);
  assert.equal(r.added[0].name, "doclib-dlbcccx");
});

test("missingBuckets 找出授权里看不到的配置", () => {
  const m = missingBuckets([{ name: "a", driveId: "DRVAAA" }, { name: "b", driveId: "gone" }], { drives, doclibs });
  assert.deepEqual(m.map((b) => b.name), ["b"]);
});

test("nameFor 只产出 S3 合法字符", () => {
  assert.match(nameFor("doclib", "DLBCCC"), /^[a-z0-9.-]+$/);
});
