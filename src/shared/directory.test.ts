import { describe, it, expect } from "vitest";
import { parseDirectoryResponse } from "./directory.ts";

describe("parseDirectoryResponse", () => {
  it("名前とメールを抽出する", () => {
    const people = parseDirectoryResponse({
      people: [
        {
          names: [{ displayName: "田中太郎" }],
          emailAddresses: [{ value: "tanaka@esm.co.jp" }]
        }
      ]
    });
    expect(people).toEqual([
      { name: "田中太郎", email: "tanaka@esm.co.jp", photo: undefined }
    ]);
  });

  it("メール無しは除外し、名前無しは email にフォールバックする", () => {
    const people = parseDirectoryResponse({
      people: [
        { names: [{ displayName: "名前だけ" }] }, // email 無し → 除外
        { emailAddresses: [{ value: "noname@esm.co.jp" }] } // 名前無し
      ]
    });
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({
      name: "noname@esm.co.jp",
      email: "noname@esm.co.jp"
    });
  });

  it("people 無しなら空配列", () => {
    expect(parseDirectoryResponse({})).toEqual([]);
  });
});
