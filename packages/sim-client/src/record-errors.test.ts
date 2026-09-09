import { expect, test } from "bun:test";
import { FrameArchive, RecordDecodeError, parseRecordHeader } from "./record";
import type { RecordLayout } from "./generated/sim";
import legacy from "../../../specs/done/retinal-vision/assets/07/schema-5.json";

test("public archive rejects frozen old schema before touching its layout", () => {
  for (const layout of [
    legacy.layout,
    { schemaVersion: 5 },
    { schemaVersion: 99 },
  ]) {
    try {
      new FrameArchive(
        { attemptId: "fixture", flyCount: 2, durationTicks: 4 },
        layout as RecordLayout,
        1,
        [],
      );
      throw Error("unsupported schema was accepted");
    } catch (error) {
      expect(error).toBeInstanceOf(RecordDecodeError);
      expect((error as RecordDecodeError).code).toBe("unsupported-record");
      expect((error as Error).message).toContain("Start a new attempt");
    }
  }
});

test("malformed current headers and metadata produce handled invalid-record errors", () => {
  for (const layout of [
    null,
    {},
    { schemaVersion: "6" },
    { schemaVersion: 6 },
    { schemaVersion: 6, noSupport: 0xffffffff },
  ]) {
    try {
      new FrameArchive(
        { attemptId: "fixture", flyCount: 2, durationTicks: 4 },
        layout as RecordLayout,
        1000,
        [],
      );
      throw Error("invalid schema was accepted");
    } catch (error) {
      expect(error).toBeInstanceOf(RecordDecodeError);
      expect((error as RecordDecodeError).code).toBe("invalid-record");
    }
  }
});

test("public wire-header parser rejects corrupt JSON and unsupported versions before payload access", () => {
  for (const raw of [
    "{",
    "null",
    "[]",
    '{"schemaVersion":6}',
    '{"schemaVersion":6,"attemptId":"fixture","sequence":-1}',
  ]) {
    expect(() => parseRecordHeader(raw)).toThrow(RecordDecodeError);
  }
  for (const raw of [
    JSON.stringify(legacy.chunks[0]),
    '{"schemaVersion":99}',
  ]) {
    try {
      parseRecordHeader(raw);
      throw Error("accepted");
    } catch (error) {
      expect((error as RecordDecodeError).code).toBe("unsupported-record");
    }
  }
});
