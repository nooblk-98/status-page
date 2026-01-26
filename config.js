const intervalSeconds = 30;
const timeoutMs = 8000;

module.exports = [
  {
    id: "nooblk-web",
    name: "NoobLk web",
    url: "https://www.itsnooblk.com",
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
  {
    id: "metrics",
    name: "Grafana Node",
    url: "https://metrics.itsnooblk.com",
    intervalSeconds,
    timeoutMs,
  },
];
