import { parseDirectoryResponse } from "./directory.ts";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ok  - ${name}`);
  } else {
    fail++;
    console.log(`  XX  - ${name}  ${extra}`);
  }
}

// --- 名前とメールを抽出 -----------------------------------------------------
{
  const people = parseDirectoryResponse({
    people: [
      {
        names: [{ displayName: "田中太郎" }],
        emailAddresses: [{ value: "tanaka@esm.co.jp" }]
      }
    ]
  });
  check("抽出: 1件返る", people.length === 1, JSON.stringify(people));
  check(
    "抽出: name/email が取れる",
    people[0]?.name === "田中太郎" && people[0]?.email === "tanaka@esm.co.jp"
  );
}

// --- メール無しは除外、名前無しは email にフォールバック ---------------------
{
  const people = parseDirectoryResponse({
    people: [
      { names: [{ displayName: "名前だけ" }] }, // email 無し → 除外
      { emailAddresses: [{ value: "noname@esm.co.jp" }] } // 名前無し
    ]
  });
  check(
    "除外: email 無しは落とす",
    people.length === 1,
    JSON.stringify(people)
  );
  check(
    "フォールバック: 名前無しは email を name に",
    people[0]?.name === "noname@esm.co.jp" &&
      people[0]?.email === "noname@esm.co.jp"
  );
}

// --- 空レスポンス -----------------------------------------------------------
{
  check("空: people 無しで空配列", parseDirectoryResponse({}).length === 0);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
if (fail > 0) {
  process.exit(1);
}
