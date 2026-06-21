import { describe, it, expect } from "vitest";
import { ruleParse } from "@/lib/network-engine/parser/rule-parser";

const count = (intent: ReturnType<typeof ruleParse>, type: string) =>
  intent.devices.find((d) => d.type === type)?.count ?? 0;

describe("ruleParse", () => {
  it("parses English counts and device types", () => {
    const intent = ruleParse("2 routers, 3 switches, 1 server, 20 PCs");
    expect(count(intent, "ROUTER")).toBe(2);
    expect(count(intent, "SWITCH")).toBe(3);
    expect(count(intent, "SERVER")).toBe(1);
    expect(count(intent, "PC")).toBe(20);
  });

  it("parses Arabic descriptions with explicit numbers", () => {
    const intent = ruleParse("2 راوتر و 3 سويتش و 1 سيرفر");
    expect(count(intent, "ROUTER")).toBe(2);
    expect(count(intent, "SWITCH")).toBe(3);
    expect(count(intent, "SERVER")).toBe(1);
  });

  it("detects VLAN intent", () => {
    expect(ruleParse("a network with vlan segmentation").options.vlan).toBe(true);
  });

  it("detects a routing protocol", () => {
    expect(ruleParse("2 routers using OSPF").options.routingProtocol).toBe("OSPF");
  });
});
