import { describe, it, expect } from "vitest";
import { buildScheduleMessage } from "./participants.ts";
import type { DirectoryPerson } from "./directory.ts";

const self = { name: "青木翔太郎", email: "self@esm.co.jp" };
const selfPerson: DirectoryPerson = { name: self.name, email: self.email };
const tanaka: DirectoryPerson = { name: "田中", email: "tanaka@esm.co.jp" };
const sato: DirectoryPerson = { name: "佐藤", email: "sato@esm.co.jp" };

describe("buildScheduleMessage", () => {
  it("自分を含むと主催を明示し、参加者の email を列挙する", () => {
    const msg = buildScheduleMessage([selfPerson, tanaka], self);
    expect(msg).toContain(self.email);
    expect(msg).toContain(tanaka.email);
    expect(msg).toContain("主催はあなた");
  });

  it("selected に自分が含まれない場合は『参加しない』と明記（防御的分岐）", () => {
    const msg = buildScheduleMessage([tanaka, sato], self);
    expect(msg).toContain(tanaka.email);
    expect(msg).not.toContain(self.email);
    expect(msg).not.toContain("主催はあなた");
    expect(msg).toContain("私自身は参加しません");
  });

  it("自分だけでも主催を明示し、他者は載らない", () => {
    const msg = buildScheduleMessage([selfPerson], self);
    expect(msg).toContain(self.email);
    expect(msg).toContain("主催はあなた");
    expect(msg).not.toContain(tanaka.email);
  });

  it("details があれば希望条件として挿入する", () => {
    const msg = buildScheduleMessage(
      [tanaka],
      self,
      "隔週1h、来月から6回、午後希望"
    );
    expect(msg).toContain("希望条件: 隔週1h、来月から6回、午後希望");
  });

  it("details が空白のみなら希望条件を挿入しない", () => {
    const msg = buildScheduleMessage([tanaka], self, "   ");
    expect(msg).not.toContain("希望条件");
  });
});
