import { buildScheduleMessage } from "./participants.ts";
import type { DirectoryPerson } from "./directory.ts";

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

const self = { name: "青木翔太郎", email: "self@esm.co.jp" };
const tanaka: DirectoryPerson = { name: "田中", email: "tanaka@esm.co.jp" };
const sato: DirectoryPerson = { name: "佐藤", email: "sato@esm.co.jp" };

// --- 自分を含む調整 ---------------------------------------------------------
{
  const selfPerson: DirectoryPerson = { name: self.name, email: self.email };
  const msg = buildScheduleMessage([selfPerson, tanaka], self);
  check("自分を含む: 自分の email が入る", msg.includes(self.email), msg);
  check("自分を含む: 他者の email が入る", msg.includes(tanaka.email), msg);
  check("自分を含む: 主催はあなたと明示", msg.includes("主催はあなた"), msg);
}

// --- 自分を除外した調整（他人同士の調整） -----------------------------------
{
  const msg = buildScheduleMessage([tanaka, sato], self);
  check("除外: 他者の email が入る", msg.includes(tanaka.email), msg);
  check("除外: 自分の email は含まれない", !msg.includes(self.email), msg);
  check("除外: 主催明示はしない", !msg.includes("主催はあなた"), msg);
  check(
    "除外: 自分は参加しないと明記",
    msg.includes("私自身は参加しません"),
    msg
  );
}

// --- 自分だけの調整 ---------------------------------------------------------
{
  const selfPerson: DirectoryPerson = { name: self.name, email: self.email };
  const msg = buildScheduleMessage([selfPerson], self);
  check("自分だけ: 自分の email が入る", msg.includes(self.email), msg);
  check("自分だけ: 主催はあなたと明示", msg.includes("主催はあなた"), msg);
  check("自分だけ: 他者は記載されない", !msg.includes(tanaka.email), msg);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
if (fail > 0) {
  process.exit(1);
}
