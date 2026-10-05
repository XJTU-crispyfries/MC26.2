/* ============================================================
 *  同源转发：/sb/*  →  https://<项目>.supabase.co/*
 *
 *  为什么需要它：
 *    国内不少网络（尤其是手机流量）会直接重置到 supabase.co 的连接，
 *    浏览器报 "Failed to fetch"，网页就读不到里程碑。
 *    而本站域名（Cloudflare Pages）在这些网络上是通的。
 *    把请求改成发到自己站上、由 Cloudflare 的服务器转给 Supabase，
 *    浏览器就再也不需要直连 supabase.co 了。
 *
 *  安全性：
 *    目标主机写死在下面，路径也做了净化，无法被改写成别的站点
 *    —— 否则这个页面就成了给任何人白用的公共代理。
 *    数据本身仍由 Supabase 的行级安全和群口令把关，转发不降低任何门槛。
 * ============================================================ */

// 目标 Supabase 主机。项目换了改这里（或者删掉整个 functions/ 目录改回直连）。
const UPSTREAM = 'https://lldognoxfhapyawffust.supabase.co';

export async function onRequest(context) {
  const { request, params } = context;

  // [[path]] 捕获的是数组，拼回路径。过滤掉空段和 . / .. ，
  // 这样 "//evil.com/x" 这种协议相对写法没法把请求带出目标主机。
  const raw = Array.isArray(params.path) ? params.path : [params.path || ''];
  const path = raw
    .filter(function (s) { return s && s !== '.' && s !== '..'; })
    .join('/');

  const url = new URL(request.url);
  const target = new URL('/' + path, UPSTREAM);
  target.search = url.search;

  // 原样带上 apikey / Authorization / Prefer 等头部，
  // 但要丢掉 host —— 否则会拿着 pages.dev 的名字去问 Supabase。
  const headers = new Headers(request.headers);
  headers.delete('host');

  const init = {
    method: request.method,
    headers: headers,
    redirect: 'manual',
  };

  // GET/HEAD 不能带 body。其余方法读成 buffer 再转发
  // （请求体都很小，流式转发没必要，还容易在某些运行时上出岔子）。
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  let upstream;
  try {
    upstream = await fetch(target.toString(), init);
  } catch (e) {
    return new Response(
      JSON.stringify({ message: '转发到 Supabase 失败：' + (e && e.message) }),
      { status: 502, headers: { 'content-type': 'application/json' } }
    );
  }

  // content-encoding / content-length 是上游那一跳的，
  // 原样回传会让浏览器按错误的长度或编码去解，必须去掉。
  const outHeaders = new Headers(upstream.headers);
  outHeaders.delete('content-encoding');
  outHeaders.delete('content-length');

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  });
}
