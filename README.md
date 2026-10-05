# 生电服 · 状态与里程碑

一个单页网页，解决两件事：

1. **服务器状态** —— 打开就能看到在不在线、几个人、什么版本，不用在群里问。
2. **生电里程碑** —— 用三段时间轴（过去 / 现在 / 将来）记录建了什么、在建什么、打算建什么，卡片可以直接拖动。

网页是纯静态的，没有后端、不用装 Node、不用自己开服务器。数据存在 Supabase 的免费数据库里，网页放在 Cloudflare Pages 上，两边都免费、都常驻在线。

---

## 一、先看看长什么样

在浏览器里打开 `index.html`，然后在网址后面加上 `?demo=1`：

```
index.html?demo=1
```

会出现几张示例卡片，排版和交互都跟真的一样，但改动不会保存。看完去掉 `?demo=1` 就回到真实数据。

> **关于字体**：直接双击 `index.html` 打开时，浏览器会因为安全策略拦掉像素字体，中文字会用系统字体显示。这是正常现象，不影响功能。想看真正的像素字体，用 VS Code 的 **Live Server** 插件打开（右键 `index.html` → Open with Live Server），或者等部署到线上就好了。

---

## 二、正式启用：三步

### 第 1 步：建数据库（Supabase）

1. 打开 [https://supabase.com](https://supabase.com)，用 GitHub 账号登录（右上角 Sign in → Continue with GitHub）。
2. 点 **New project**：

   - **Name** 随便填，比如 `mc-server`
   - **Database Password** 随便生成一个，**存下来**（后面基本用不到，但丢了麻烦）
   - **Region** 选 **Southeast Asia (Singapore)** 或 **Northeast Asia (Tokyo)**，离国内近一点
3. 等两三分钟，等它建好。
4. 左边栏点 **SQL Editor** → **New query**，把本仓库里 `schema.sql` 的**全部内容**粘进去 → 点 **Run**。

   跑完会显示 `Success. No rows returned`；结果区最后还会出现一张自检小表，**三个值必须都是 `true`**：

   | 里程碑表已开行级安全 | 口令表已开行级安全 | 匿名用户已无写权限 |
   | -------------------- | ------------------ | ------------------ |
   | true                 | true               | true               |

   如果有一个是 `false`，说明脚本没跑完整，重新贴一遍再 Run 一次（重复执行是安全的）。
5. **改群口令**：在同一个 SQL Editor 里执行下面这句，把口令换成你们群自己的（引号要留着）：

   ```sql
   update public.app_config
      set value = '你们群的暗号'
    where key = 'write_passcode';
   ```
6. 左边栏点 **Project Settings**（齿轮图标）→ **API Keys**，复制两样东西：

   - **Project URL** —— 形如 `https://lldognoxfhapyawffust.supabase.co`

     中间那串 20 位小写字母（`lldognoxfhapyawffust`）叫**项目 ID**，是网址的一部分，**不是密钥**。
   - **Publishable key** —— 一长串，以 **`sb_publishable_`** 开头

   这两样都在该页顶部的 **「Publishable and secret API keys」** 标签页里，点右边的复制按钮。

> ### ⚠️ 千万别复制错
>
> | 东西                 | 长什么样                             | 用在哪                                |
> | -------------------- | ------------------------------------ | ------------------------------------- |
> | **项目 ID**          | 20 位小写字母，如 `lldognoxfhapyawffust` | 只用来拼网址（可只填这个，会自动补全） |
> | ✅**Publishable key** | `sb_publishable_` 开头的一长串       | **填进 `supabaseKey`**                |
> | ❌ Secret key         | `sb_secret_` 开头的一长串            | **绝不能填**，那是数据库管理密钥      |
>
> 把 Secret key 填进网页，等于把数据库交给任何一个打开网页的人，他们能删光所有记录。
>
> **不用怕记混**：本页启动时会自己检查。填成 Secret key 会弹红色警告并停止运行；
> 填成项目 ID 也会明确告诉你「这填的是项目 ID，不是密钥」。
>
> > 补充：2025 年 11 月之后新建的 Supabase 项目**不再提供老的 `anon` / `service_role` 密钥**，
> > 只有上面这两种新的。所以在后台看不到 `anon` 是正常的，用 Publishable key 就对了。

### 第 2 步：填配置

打开 `js/config.js`，填两处：

```js
  server: {
    host: 'g1-1.xyeidc.cn',     // 服务器域名，地址变了改这里
    port: 20482,                // 端口，数字不加引号
    label: '生电服',             // 页面上显示的名字
  },

  supabaseUrl: 'https://lldognoxfhapyawffust.supabase.co',   // ← Project URL（已填好）
  supabaseKey: 'sb_publishable_xxxxxxxxxxxx',                // ← 填 Publishable key

  supabaseProxyPath: '/sb',   // ← 走同源转发，别删，原因见下面「为什么要转发」
```

`supabaseKey` 就是唯一还需要你动手的地方。

保存，刷新页面。里程碑区域应该就能用了。

> ### 为什么要转发（`supabaseProxyPath`）
>
> 国内不少网络会**直接掐断到 `supabase.co` 的连接**，手机流量尤其明显。表现是：
> **电脑上一切正常，手机上却显示「里程碑没数据」**。网页本身打得开（本站域名是通的），
> 只是读不到数据 —— 于是很容易误判成「数据库被暂停了，要去 Restore」，其实不是。
>
> 填上 `/sb` 之后，网页不再直连 supabase.co，而是请求本站自己的 `/sb/*`，
> 由 Cloudflare 的服务器转给 Supabase。浏览器从此只跟本站域名打交道，
> supabase.co 通不通就跟前端无关了。转发代码在 `functions/sb/[[path]].js`。
>
> **判断是不是这个原因**：电脑正常 + 手机不行 = 基本就是它。
> 想立刻确认，用手机浏览器打开这个网址，转圈打不开就说明是这个原因：
>
> ```
> https://lldognoxfhapyawffust.supabase.co/rest/v1/
> ```
>
> **本地双击 `index.html` 时转发不生效**（`file://` 没有同源后端可用），
> 会自动退回直连 —— 所以本地预览时如果网络掐 supabase.co，里程碑区还是会报错，这是正常的，
> 看线上效果即可。

### 第 3 步：传到网上（Cloudflare Pages）

1. 把整个文件夹传到你的 GitHub 仓库（见下一节的命令）。
2. 打开 [https://dash.cloudflare.com](https://dash.cloudflare.com) 注册/登录，左边栏选 **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。
3. 选中你刚才那个仓库。
4. 构建设置全部留空：
   - **Framework preset**：`None`
   - **Build command**：留空
   - **Build output directory**：`/`
5. 点 **Save and Deploy**。一两分钟后会给你一个 `xxx.pages.dev` 的网址，把这个发到群里就行。

以后你每次 `git push`，Cloudflare 会自动重新部署，不用再手动操作。

---

## 三、传到 GitHub

在 `E:\MC\网页` 里打开终端（Git Bash 或 PowerShell），执行：

```bash
git init
git add .
git commit -m "生电服状态与里程碑网页"
git branch -M main
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

> `js/config.js` 里的 Supabase 信息**不用担心泄露**。Publishable key 本来就是公开的（等价于老的 `anon` key），写权限由数据库那边的群口令控制，前端改不动。真正的禁区是 Secret key，而那个我们已经用启动检查拦住了。

---

## 四、日常怎么用

- **看服务器**：打开网页，最上面那张卡就是状态，每 60 秒自动更新，也可以点「刷新」。
- **加一条**：点某个区段右上角的「＋」（会直接落到那个区段），或者点右上角大按钮「＋ 新建」——后者会先问你**在过去、现在还是将来**。
- **拖动**：按住卡片**最左边那条竖条**（`⠿` 那个把手）拖。
  - 横向拖到别的区段 → 改变时间归属
  - 同一列里上下拖 → 改顺序
  - 点卡片其他任何地方是**打开编辑**，不会误触拖动。
- **改 / 删**：点卡片打开表单，左下角有「删除」。
- **筛选**：卡片多了以后，上面会出现分类标签，点一下就只看那一类。
- **群口令**：第一次写入时会问一次，存在你这台设备上，之后不用再输。

---

## 五、出错了看这里

页面会直接把原因显示出来，对照下表：

| 页面提示                          | 什么意思                         | 怎么办                                                                              |
| --------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------- |
| 数据服务还没配置                  | `js/config.js` 还是空的        | 填上 Supabase 网址和密钥                                                            |
| ⛔ 配置错误：填的是数据库管理密钥 | 填成 Secret key 了             | 换成 Publishable key，立刻换                                                        |
| 这填的是项目 ID，不是密钥         | `supabaseKey` 填成了那 20 位小写字母 | 那一行要填 `sb_publishable_` 开头的长串                                       |
| Supabase 密钥看起来不对           | 密钥复制少了字符                 | 回后台重新完整复制一次                                                              |
| Supabase URL 不正确               | 网址多了`/rest/v1/` 之类的尾巴 | 只留`https://xxx.supabase.co`                                                     |
| 连不上数据服务                    | 当前网络掐断了 supabase.co，或项目被暂停 | **先看是不是「电脑正常、手机不行」** —— 那是网络阻断，不是数据库问题，`supabaseProxyPath` 配好即可。若所有设备都不行，才是免费项目**7 天没人访问自动暂停**，去 Supabase 后台点 **Restore** 唤醒 |
| 数据库里还没建表                  | `schema.sql` 没执行            | 回第 1 步第 4 点                                                                    |
| 保存被数据库拒绝                  | 权限没配好                       | 把`schema.sql` 完整重跑一遍（可以重复执行）                                       |
| 群口令不正确                      | 口令错了，或群主换过             | 问群主要                                                                            |
| 状态查询失败                      | 两个公开接口都连不上             | 通常是网络问题，点「刷新」重试                                                      |

**状态卡显示「离线」但服务器其实开着？** 说明这个域名/端口没法从公网做 Minecraft 服务器列表探测（面板可能只放行了游戏端口）。找星叶云联确认一下，或者换个能被外部 ping 到的地址。

---

## 六、备份数据

免费版 Supabase 没有长期备份。建议偶尔导出一次：

Supabase 后台 → **Table Editor** → `milestones` 表 → 右上角 **Export** → 存一份 CSV 到本地。

万一被误删，可以照着 CSV 手工填回来。

---

## 七、目录说明

```
index.html          页面本体
css/style.css       像素风样式
js/config.js        ★ 你唯一需要改的文件
js/boot.js          启动自检（配置校验、密钥类型检查）
js/status.js        服务器状态卡
js/milestones-api.js 数据库读写
js/timeline.js      时间轴渲染与拖拽
js/editor.js        新建 / 编辑 / 删除表单
js/gate.js          群口令输入框
js/toast.js         右下角提示
vendor/             第三方库（已本地化，不依赖 CDN）
functions/sb/       Cloudflare Pages 转发口，把 /sb/* 转给 Supabase
                    （用来绕开国内对 supabase.co 的阻断，别删）
fonts/              像素中文字体 + 许可证
dev/demo-data.js    示例数据，可直接删掉
schema.sql          数据库建表脚本
```

---

## 八、依赖与许可

全部本地化在 `vendor/` 和 `fonts/` 里，不依赖任何 CDN —— 因为 jsDelivr 在国内时常被墙。

| 组件                                                             | 版本                 | 许可证                             |
| ---------------------------------------------------------------- | -------------------- | ---------------------------------- |
| [supabase-js](https://github.com/supabase/supabase-js)            | 2.117.2              | MIT                                |
| [SortableJS](https://github.com/SortableJS/Sortable)              | 1.15.6               | MIT                                |
| [Fusion Pixel Font](https://github.com/TakWolf/fusion-pixel-font) | 12px Proportional SC | SIL OFL 1.1（见`fonts/OFL.txt`） |

> 字体特意**没有**用更常见的 [Zpix 最像素](https://github.com/SolidZORO/zpix-pixel-font)：Zpix 的授权是「个人免费、商业收费、禁止修改与再分发」，不适合放进公开仓库。Fusion Pixel 是 OFL 授权，可自由使用和再分发。

---

## 九、免费版的坑

- **Supabase 免费项目 7 天无访问会被暂停**。群友天天看就不会停；真停了，去后台点 Restore 即可，数据还在。
- **Cloudflare Pages 免费额度**对这个小站来说用不完。
- 服务器状态查询走的是公开接口（mcstatus.io / mcsrvstat.us），有约 60 秒缓存，所以延迟几十秒是正常的。
