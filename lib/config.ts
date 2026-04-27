export const intervalSeconds = 30;
export const timeoutMs = 8000;

export interface SiteConfig {
  id: string;
  name: string;
  url: string;
  intervalSeconds: number;
  timeoutMs: number;
}

export const sites: SiteConfig[] = [
  {
    id: "nooblk-web",
    name: "NoobLk web",
    url: "https://www.itsnooblk.com",
    intervalSeconds,
    timeoutMs,
  },
  {
    id: "openwrt-git",
    name: "OpenWrt Git",
    url: "https://git.openwrt.org/",
    intervalSeconds,
    timeoutMs,
  },
  {
    id: "openwrt-downloads",
    name: "OpenWrt Downloads",
    url: "https://downloads.openwrt.org/",
    intervalSeconds,
    timeoutMs,
  },
  {
    id: "jenkins",
    name: "Jenkins Site",
    url: "https://jk.itsnooblk.com",
    intervalSeconds,
    timeoutMs: 8000,
  },
  {
    id: "templ-dowdnload",
    name: "Temp Dowdnload Site",
    url: "https://dl.itsnooblk.com",
    intervalSeconds,
    timeoutMs: 8000,
  },
  {
    id: "portainer",
    name: "Portainer Node",
    url: "https://portainer.itsnooblk.com",
    intervalSeconds,
    timeoutMs,
  },
];
