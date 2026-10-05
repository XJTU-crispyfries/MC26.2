/* ============================================================
 *  配置文件 —— 只有这个文件需要你手动改
 * ============================================================
 *
 *  改完之后直接保存即可，不需要重新构建、不需要 npm。
 */

window.CONFIG = {

  /* ---------------------------------------------------------
   * 1. Minecraft 服务器地址
   * ---------------------------------------------------------
   * 域名和端口分开填。端口是数字，不加引号。
   * 地址变了只改这里就行。
   */
  server: {
    host: 'g1-1.xyeidc.cn',
    port: 20482,
    // 显示在状态卡上的名字
    label: '生电服',
  },


  /* ---------------------------------------------------------
   * 2. Supabase（里程碑数据的存放处）
   * ---------------------------------------------------------
   * 后台路径：Project Settings（齿轮）→ API Keys
   *
   *   supabaseUrl   → 你的项目网址，已经帮你填好了。
   *                   也可以只填项目 ID（那 20 位小写字母），
   *                   本页会自动补成完整网址。
   *
   *   supabaseKey   → 公开密钥，两种形式都行，哪个能拿到用哪个：
   *                     · Publishable key —— sb_publishable_ 开头的一长串
   *                       （2025 年 11 月之后新建的项目只有这种）
   *                     · 老式的 anon key —— eyJ 开头的一长串
   *                       （本项目用的就是这种，已经填好了）
   *
   *   ⚠️ 同一页上还有个 Secret key（sb_secret_ 开头）或 service_role。
   *      那个是数据库管理密钥，放进网页等于把整个数据库
   *      交给全世界。本页启动时会校验，填错会直接红条拦下。
   *
   * 还没拿到密钥的话，先留空，网页会显示
   * 「数据服务未配置」的提示，服务器状态卡照常能用。
   */
  supabaseUrl: 'https://lldognoxfhapyawffust.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsZG9nbm94ZmhhcHlhd2ZmdXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExNzU4NDAsImV4cCI6MjEwNjc1MTg0MH0.zADOIASbCF8PdKLcBGs5Mx81IKRliI5b2I3NczmxjwE',


  /* ---------------------------------------------------------
   * 3. 刷新频率（秒）
   * ---------------------------------------------------------
   * 状态接口自身有约 60 秒缓存，填小于 60 没有意义。
   */
  statusRefreshSeconds: 60,

  // 里程碑列表多久重新拉一次（别人刚加的卡片多久能看到）
  milestonesRefreshSeconds: 30,

};
