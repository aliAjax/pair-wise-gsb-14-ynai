// 站区联动数据：站点归属区域，区域维护各油品指导价。

export interface StationInfo {
  name: string;
  region: string;
}

export const STATIONS: readonly StationInfo[] = [
  { name: "城东加油站", region: "华东一区" },
  { name: "滨江路加油站", region: "华东一区" },
  { name: "高新区加油站", region: "华东二区" },
  { name: "机场路加油站", region: "华北一区" },
  { name: "临港加油站", region: "华南一区" },
];

export const FUELS = ["92号汽油", "95号汽油", "98号汽油", "柴油"] as const;

export const GUIDE_PRICES: Record<string, Record<string, number>> = {
  华东一区: { "92号汽油": 7.85, "95号汽油": 8.36, "98号汽油": 9.12, 柴油: 7.48 },
  华东二区: { "92号汽油": 7.88, "95号汽油": 8.39, "98号汽油": 9.18, 柴油: 7.51 },
  华北一区: { "92号汽油": 7.79, "95号汽油": 8.3, "98号汽油": 9.05, 柴油: 7.44 },
  华南一区: { "92号汽油": 7.92, "95号汽油": 8.44, "98号汽油": 9.21, 柴油: 7.55 },
};

export function regionOf(station: string): string {
  return STATIONS.find((item) => item.name === station)?.region ?? "";
}

export function guidePriceOf(station: string, fuel: string): number | null {
  const region = regionOf(station);
  const price = region ? GUIDE_PRICES[region]?.[fuel] : undefined;
  return typeof price === "number" ? price : null;
}
