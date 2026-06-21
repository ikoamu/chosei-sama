import { isOwnAgentPath } from "./agent-access.ts";

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

const me = "shotaro.aoki@esm.co.jp";

// --- 自分の Agent インスタンスは許可 ---------------------------------------
check(
  "自分: 自分のメール名なら許可",
  isOwnAgentPath("/agents/chat-agent/shotaro.aoki@esm.co.jp", me)
);

// --- 他人のインスタンスは拒否 ----------------------------------------------
check(
  "他人: 別メール名は拒否",
  !isOwnAgentPath("/agents/chat-agent/victim@esm.co.jp", me)
);

// --- URL エンコードされた @ も解決 -----------------------------------------
check(
  "エンコード: %40 をデコードして一致",
  isOwnAgentPath("/agents/chat-agent/shotaro.aoki%40esm.co.jp", me)
);

// --- メールの大文字小文字は無視 --------------------------------------------
check(
  "大小無視: 大文字でも一致",
  isOwnAgentPath("/agents/chat-agent/Shotaro.Aoki@ESM.co.jp", me)
);

// --- RPC など後続パスがあってもインスタンス名で判定 -------------------------
check(
  "サブパス: 自分なら許可",
  isOwnAgentPath("/agents/chat-agent/shotaro.aoki@esm.co.jp/call/foo", me)
);
check(
  "サブパス: 他人なら拒否",
  !isOwnAgentPath("/agents/chat-agent/victim@esm.co.jp/call/foo", me)
);

// --- インスタンス名が無いパスは委ねる（許可）------------------------------
check(
  "委譲: インスタンス名なしは許可",
  isOwnAgentPath("/agents/chat-agent", me)
);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
if (fail > 0) {
  process.exit(1);
}
