import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { OpenAPIObject } from "@nestjs/swagger";

import { buildOpenApiDocument } from "@/common/openapi/openapi.setup";

import { createTestApp } from "../test/create-test-app";

const OUTPUT_PATH = path.join(process.cwd(), "openapi.json");
const PACKAGE_JSON_PATH = path.join(process.cwd(), "package.json");
const CHECK_FLAG = "--check";

/** The subset of `package.json` this script reads. */
type PackageManifest = {
  name: string;
  version: string;
};

/**
 * Narrows a value to a {@link PackageManifest}.
 *
 * @param value - The parsed `package.json` contents.
 * @returns True when `value` has a string `name` and `version`.
 */
function isPackageManifest(value: unknown): value is PackageManifest {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>)["name"] === "string" &&
    typeof (value as Record<string, unknown>)["version"] === "string"
  );
}

/**
 * Reads the service's name and version from `package.json`, so the
 * generated document always matches the running service — `npm_package_*`
 * env vars aren't populated under pnpm, so this reads the file directly
 * instead.
 *
 * @returns The package's name and version.
 */
function readPackageManifest(): PackageManifest {
  const parsed: unknown = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8"));

  if (!isPackageManifest(parsed)) {
    throw new Error(`${PACKAGE_JSON_PATH} is missing a string name/version`);
  }

  return parsed;
}

/**
 * Recursively sorts an object's keys so serialization is deterministic
 * regardless of property insertion order.
 *
 * @param value - The value to sort. Non-plain-object values pass through.
 * @returns A structurally identical value with object keys sorted.
 */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }

  if (isPlainRecord(value)) {
    // `toSorted` needs ES2023 lib, which this project's tsconfig does not include; `Object.keys`
    // already returns a fresh array, so sorting it in place mutates no shared state.
    // eslint-disable-next-line unicorn/no-array-sort
    const sortedKeys = Object.keys(value).sort((a, b) => a.localeCompare(b));
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      result[key] = sortKeysDeep(value[key]);
    }
    return result;
  }

  return value;
}

/**
 * Narrows a value to a plain string-keyed record.
 *
 * @param value - The value to check.
 * @returns True when the value is a non-null, non-array object.
 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Serializes an OpenAPI document deterministically: sorted keys, 2-space
 * indent, trailing newline.
 *
 * @param document - The OpenAPI document to serialize.
 * @returns The formatted JSON string.
 */
function serialize(document: OpenAPIObject): string {
  return `${JSON.stringify(sortKeysDeep(document), null, 2)}\n`;
}

/**
 * Boots the app without listening, generates the OpenAPI document, and
 * either writes it to disk or checks it matches the committed file.
 *
 * @returns A promise that resolves once generation or checking is done.
 */
async function main(): Promise<void> {
  // Boots the real AppModule on an in-memory Mongo and a mocked Redis, so the
  // document can be generated hermetically (CI has no database).
  const { app, stop } = await createTestApp();

  const { name, version } = readPackageManifest();
  const document = buildOpenApiDocument(app, { title: name, version });
  const serialized = serialize(document);

  const shouldCheck = process.argv.includes(CHECK_FLAG);

  if (shouldCheck) {
    const existing = existsSync(OUTPUT_PATH)
      ? readFileSync(OUTPUT_PATH, "utf8")
      : "";

    if (existing !== serialized) {
      console.error(
        `openapi.json is out of date. Run "pnpm run openapi:generate" and commit the result.`,
      );
      await stop();
      process.exit(1);
    }
  } else {
    writeFileSync(OUTPUT_PATH, serialized);
  }

  await stop();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
