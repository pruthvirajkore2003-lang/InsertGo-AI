import { describe, expect, it } from "vitest";
import { expandBlaze, parseBlazeCommands } from "./blazeCommands";

describe("parseBlazeCommands", () => {
  it("parses formtext with name and default", () => {
    const { fields } = parseBlazeCommands("Len: {formtext: name=length; default=10}");
    expect(fields).toEqual([
      { kind: "text", name: "length", label: "length", default: "10" },
    ]);
  });

  it("parses formparagraph", () => {
    const { fields } = parseBlazeCommands("{formparagraph: name=content}");
    expect(fields[0]).toMatchObject({ kind: "paragraph", name: "content" });
  });

  it("treats formmenu default as the first + selected option, rest as options", () => {
    const { fields } = parseBlazeCommands(
      "{formmenu: default=shorter; longer; more engaging; simpler}"
    );
    expect(fields[0]).toMatchObject({
      kind: "menu",
      default: "shorter",
      options: ["shorter", "longer", "more engaging", "simpler"],
      multiple: false,
    });
  });

  it("parses multiple=yes and keeps a leading bare label tolerantly", () => {
    const { fields } = parseBlazeCommands(
      "{formmenu: cities; default=NYC; name=interests; LA; multiple=yes}"
    );
    expect(fields[0]).toMatchObject({
      kind: "menu",
      name: "interests",
      options: ["cities", "NYC", "LA"],
      default: "NYC",
      multiple: true,
    });
  });

  it("parses formtoggle", () => {
    const { fields } = parseBlazeCommands(
      "{formtoggle: name=Add note; default=yes}hi{endformtoggle}"
    );
    expect(fields[0]).toMatchObject({ kind: "toggle", name: "Add note", default: "yes" });
  });

  it("flags clipboard (single-brace and legacy) without making a field", () => {
    expect(parseBlazeCommands("a {clipboard} b").hasClipboard).toBe(true);
    expect(parseBlazeCommands("a {{selected_text}} b").hasClipboard).toBe(true);
    expect(parseBlazeCommands("a {clipboard} b").fields).toEqual([]);
  });

  it("de-dupes fields sharing a name, first-seen order", () => {
    const { fields } = parseBlazeCommands(
      "{formtext: name=a} {formtext: name=b} {formtext: name=a}"
    );
    expect(fields.map((f) => f.name)).toEqual(["a", "b"]);
  });

  it("reports malformed {form…} tokens as unparsed", () => {
    const { fields, unparsed } = parseBlazeCommands("ok {formwidget: x=1} end");
    expect(fields).toEqual([]);
    expect(unparsed).toEqual(["{formwidget: x=1}"]);
  });

  it("generates distinct names for unnamed menus", () => {
    const { fields } = parseBlazeCommands("{formmenu: default=a; b} {formmenu: default=c; d}");
    expect(fields.length).toBe(2);
    expect(fields[0].name).not.toBe(fields[1].name);
  });
});

describe("expandBlaze", () => {
  it("substitutes text/menu values and clipboard", () => {
    const body = "Make it {formmenu: default=short; long}: {formtext: name=x}. {clipboard}";
    const out = expandBlaze(body, { x: "hi" }, "CLIP");
    // menu falls back to its default when no value supplied
    expect(out).toBe("Make it short: hi. CLIP");
  });

  it("falls back to a field default when no value is given", () => {
    const out = expandBlaze("{formtext: name=x; default=D}", {}, "");
    expect(out).toBe("D");
  });

  it("joins a multi-select value passed pre-joined by the caller", () => {
    const body = "Tone: {formmenu: default=A; B; C; multiple=yes}";
    // menus key by generated name for the unnamed case
    const { fields } = parseBlazeCommands(body);
    const out = expandBlaze(body, { [fields[0].name]: "A, B" }, "");
    expect(out).toBe("Tone: A, B");
  });

  it("keeps a formtoggle span when on, expanding inner commands", () => {
    const body = "x {formtoggle: name=t; default=yes}note {formtext: name=n}{endformtoggle} y";
    expect(expandBlaze(body, { t: "yes", n: "N" }, "")).toBe("x note N y");
  });

  it("removes a formtoggle span (and inner commands) when off", () => {
    const body = "x {formtoggle: name=t; default=no}note {formtext: name=n}{endformtoggle} y";
    expect(expandBlaze(body, { t: "no", n: "N" }, "")).toBe("x  y");
  });

  it("expands legacy {{selected_text}} from clipboard", () => {
    expect(expandBlaze("Explain:\n{{selected_text}}", {}, "CODE")).toBe("Explain:\nCODE");
  });

  it("leaves malformed {form…} tokens intact", () => {
    expect(expandBlaze("a {formwidget: x=1} b", {}, "")).toBe("a {formwidget: x=1} b");
  });

  it("produces zero residual command tokens for a real library body", () => {
    const body =
      "Rewrite to be {formmenu: default=shorter; longer}.{clipboard} Tone: {formmenu: default=Pro; Casual; multiple=yes}. {formtoggle: name=note; default=yes}extra{endformtoggle}";
    const out = expandBlaze(
      body,
      { __f2: "Pro, Casual", note: "yes" },
      "TEXT"
    );
    expect(out).not.toMatch(/\{(form|clipboard|endform)/);
  });
});

describe("ReDoS / linear-time guard", () => {
  it("parses a large adversarial input in bounded time", () => {
    // Mix of unclosed braces, junk tokens, and real commands.
    const chunk = "{{{ {foo} {formtext: name=a} plain {formmenu: default=x; y} ";
    const big = chunk.repeat(20000) + "{".repeat(50000);
    const start = Date.now();
    const { fields } = parseBlazeCommands(big);
    const ms = Date.now() - start;
    expect(fields.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(1000); // O(n²) on this size would be seconds+
  });
});
