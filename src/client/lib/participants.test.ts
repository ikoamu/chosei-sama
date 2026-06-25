import { describe, it, expect } from "vitest";
import { buildScheduleMessage } from "./participants.ts";
import type { DirectoryPerson } from "./directory.ts";

const self = { name: "青木翔太郎", email: "self@esm.co.jp" };
const selfPerson: DirectoryPerson = { name: self.name, email: self.email };
const tanaka: DirectoryPerson = { name: "田中", email: "tanaka@esm.co.jp" };
const sato: DirectoryPerson = { name: "佐藤", email: "sato@esm.co.jp" };

describe("buildScheduleMessage", () => {
  it("自分を含むと主催を名前+メールで明示し、参加者の email を列挙する", () => {
    const msg = buildScheduleMessage([selfPerson, tanaka], self);
    expect(msg).toContain(self.email);
    expect(msg).toContain(tanaka.email);
    expect(msg).toContain(`主催者は ${self.name} <${self.email}>`);
    // role=user メッセージでは「あなた」はアシスタントを指すため使わない
    expect(msg).not.toContain("あなた");
  });

  it("selected に自分が含まれない場合は『参加しない』と明記（防御的分岐）", () => {
    const msg = buildScheduleMessage([tanaka, sato], self);
    expect(msg).toContain(tanaka.email);
    expect(msg).not.toContain(self.email);
    expect(msg).not.toContain("主催者は");
    expect(msg).toContain("参加しません");
  });

  it("自分だけでも主催を名前+メールで明示し、他者は載らない", () => {
    const msg = buildScheduleMessage([selfPerson], self);
    expect(msg).toContain(self.email);
    expect(msg).toContain(`主催者は ${self.name} <${self.email}>`);
    expect(msg).not.toContain(tanaka.email);
  });

  it("details があれば調整条件としてそのまま載せる", () => {
    const msg = buildScheduleMessage(
      [tanaka],
      self,
      "所要時間: 1h\nいつまで: 来月末まで"
    );
    expect(msg).toContain("調整条件:");
    expect(msg).toContain("所要時間: 1h\nいつまで: 来月末まで");
  });

  it("details が空白のみなら調整条件を載せない", () => {
    const msg = buildScheduleMessage([tanaka], self, "   ");
    expect(msg).not.toContain("調整条件");
  });
});
