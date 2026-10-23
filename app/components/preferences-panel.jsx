export default function PreferencesPanel(){return <section className="account-preferences" aria-label="账号抽签偏好与消息">
 <div className="card preference-heading"><div><span className="portal-eyebrow">LOTTERY PREFERENCES</span><h2>抽签偏好 · 账号消息</h2><p>仅提醒仍在抽签中、已确认且未截止的商品。采集后自动匹配，网页关闭后仍会保存在账号消息箱。</p></div><button type="button" className="button secondary" id="pref-check">检查已采集数据</button></div>
 <p id="pref-status" role="status" aria-live="polite">正在读取账号状态…</p><div id="pref-guest" hidden><button className="button" type="button" id="pref-login">微信登录后设置偏好</button></div>
 <div id="pref-account" hidden><div className="preference-columns"><section className="card preference-editor"><h3 id="pref-form-title">新增抽签偏好</h3>
 <form id="pref-form"><label>偏好名称<input id="pref-name" maxLength={50} placeholder="例如：想要的四孔花重锦" /></label>
 <div className="pref-fields"><label>谪星外观<select id="pref-type" required defaultValue=""><option value="" disabled>请选择谪星</option></select></label><label>已解锁孔数<select id="pref-holes" defaultValue=""><option value="">不限孔数</option></select></label></div>
 <div id="pref-ranges" className="pref-ranges"></div><p className="preference-help">数值留空表示不限；填写范围的孔位必须已解锁。0 也是有效数值。</p>
 <div className="pref-fields"><label>最低价格（元）<input id="pref-price-min" type="number" min="0" max="100000000" step="0.01" placeholder="不限" /></label><label>最高价格（元）<input id="pref-price-max" type="number" min="0" max="100000000" step="0.01" placeholder="不限" /></label></div>
 <div className="pref-options"><label><input type="checkbox" id="pref-enabled" defaultChecked /> 启用此偏好</label><span>✓ 站内消息</span><label><input type="checkbox" id="pref-wechat" disabled /> 微信提醒</label></div><p className="preference-help" id="pref-wechat-help">微信模板提醒尚未配置，站内消息可正常使用。</p>
 <div className="pref-actions"><button className="button" type="submit" id="pref-save">保存并检查</button><button className="button secondary" type="button" id="pref-reset">取消编辑 / 新增</button></div></form></section>
 <section className="card preference-saved"><h3>已保存偏好 <span id="pref-count">0 / 20</span></h3><div id="pref-list"></div></section></div>
 <section className="card account-inbox"><div className="pref-inbox-heading"><div><h3>我的消息 <span id="pref-unread">0 条未读</span></h3><p>新商品或同件商品降价时提醒；同一偏好、商品及价格去重。消息最多保留30天、1000条。</p></div><button type="button" className="button secondary" id="pref-read-all">全部已读</button></div><div id="pref-messages"></div><button type="button" className="button secondary" id="pref-more" hidden>加载更早消息</button></section>
 </div></section>}
