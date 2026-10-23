const fs = require('fs');
const P = 'roleplay-ai-prototype-v3.html';
let src = fs.readFileSync(P, 'utf8');
const origLen = src.length;

// ---------- 1. New translation keys (th / en / zh) ----------
const NEW_KEYS = {
  btn_sound_off: ['เปิดเสียงเอฟเฟกต์', 'Unmute sound effects', '開啟音效'],
  toast_lang_code_invalid: ['รหัสภาษาต้องเป็นตัวอักษร 2-10 ตัว (เช่น ja, es, fr)', 'Language code must be 2-10 characters (e.g. ja, es, fr)', '語言代碼需為 2-10 個字元（例如 ja、es、fr）'],
  toast_lang_name_required: ['กรุณาระบุชื่อภาษาที่แสดง', 'Please enter a display name for the language', '請輸入語言顯示名稱'],
  toast_lang_json_invalid: ['ข้อมูล JSON ไม่ถูกต้อง กรุณาตรวจสอบไวยากรณ์', 'Invalid JSON. Please check the syntax.', 'JSON 格式無效，請檢查語法'],
  persona_created: ['สร้าง Persona ใหม่แล้ว', 'New persona created', '已建立新 Persona'],
  persona_saved: ['บันทึก Persona "{name}" แล้ว', 'Saved persona "{name}"', '已儲存 Persona「{name}」'],
  persona_deleted: ['ลบ Persona แล้ว', 'Persona deleted', '已刪除 Persona'],
  persona_min_one: ['ต้องมี Persona อย่างน้อย 1 รายการ', 'At least one persona is required', '至少需要保留一個 Persona'],
  persona_name_required: ['กรุณาระบุชื่อ Persona ของคุณ', 'Please enter your persona name', '請輸入你的 Persona 名稱'],
  image_pick_failed: ['เลือกภาพไม่สำเร็จ', 'Failed to pick image', '選擇圖片失敗'],
  file_type_error: ['เลือกไฟล์ PNG, JPG หรือ WebP', 'Choose a PNG, JPG or WebP file', '請選擇 PNG、JPG 或 WebP 檔案'],
  file_size_error: ['ไฟล์ภาพใหญ่เกิน 3 MB', 'Image file is larger than 3 MB', '圖片檔案超過 3 MB'],
  file_read_error: ['อ่านไฟล์ภาพไม่ได้', 'Could not read the image file', '無法讀取圖片檔案'],
  chat_empty_export: ['ยังไม่มีบทสนทนาให้บันทึก', 'No conversation to export yet', '尚無對話可匯出'],
  export_md_done: ['บันทึกเรื่องราวเป็นไฟล์ Markdown แล้ว', 'Story saved as a Markdown file', '故事已儲存為 Markdown 檔案'],
  chat_empty_copy: ['ยังไม่มีบทสนทนา', 'No conversation yet', '尚無對話'],
  copied_chat: ['คัดลอกบทสนทนาแล้ว', 'Conversation copied', '對話已複製'],
  copy_clipboard_unsupported: ['เบราว์เซอร์ไม่รองรับคลิปบอร์ด', 'Browser does not support clipboard', '瀏覽器不支援剪貼簿'],
  char_info_not_found: ['ไม่พบข้อมูลตัวละคร', 'Character info not found', '找不到角色資訊'],
  info_modal_default_title: ['ข้อมูลตัวละคร', 'Character info', '角色資訊'],
  info_unspecified: ['ไม่ระบุ', 'Not specified', '未說明'],
  preview_default_name: ['ชื่อตัวละคร', 'Character name', '角色名稱'],
  preview_default_role: ['บทบาทของตัวละคร', 'Character role', '角色設定'],
  save_char_name_required: ['ใส่ชื่อตัวละครก่อน', 'Enter a character name first', '請先輸入角色名稱'],
  default_new_char_role: ['ตัวละครใหม่', 'New character', '新角色'],
  default_new_char_desc: ['ตัวละครที่คุณสร้างเอง', 'A character you created', '你自行建立的角色'],
  default_greeting: ['สวัสดี ยินดีที่ได้พบกัน', 'Hello, nice to meet you.', '你好，很高興見到你。'],
  saving_btn: ['กำลังบันทึก…', 'Saving…', '儲存中…'],
  server_connect_failed: ['เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 'Could not connect to the server', '無法連線至伺服器'],
  char_save_failed: ['บันทึกตัวละครไม่สำเร็จ', 'Failed to save character', '角色儲存失敗'],
  char_created: ['สร้างตัวละครและบันทึกแล้ว', 'Character created and saved', '角色已建立並儲存'],
  model_id_required: ['ใส่ model ID ก่อน', 'Enter a model ID first', '請先輸入模型 ID'],
  manual_model_used: ['ใช้โมเดล {model}', 'Using model {model}', '使用模型 {model}'],
  prompt_reset_done: ['คืนค่าพรอมต์หลักแล้ว', 'System prompt restored to default', '系統提示詞已恢復預設值'],
  host_add_required: ['ใส่ hostname ก่อน', 'Enter a hostname first', '請先輸入主機名稱'],
  host_add_failed: ['เพิ่ม host ไม่ได้', 'Failed to add host', '新增主機失敗'],
  host_del_failed: ['ลบ host ไม่ได้', 'Failed to remove host', '刪除主機失敗'],
  retry_no_messages: ['ยังไม่มีข้อความให้ลองใหม่', 'No message to retry yet', '尚無可重試的訊息'],
  ai_chat_failed: ['คุยกับ AI ไม่สำเร็จ', 'Chat with AI failed', '與 AI 對話失敗'],
  del_char_failed: ['ลบไม่สำเร็จ', 'Delete failed', '刪除失敗'],
  del_char_generic: ['ลบตัวละครไม่สำเร็จ', 'Failed to delete character', '角色刪除失敗'],
  fetch_models_fail: ['ดึงโมเดลไม่สำเร็จ', 'Failed to fetch models', '模型獲取失敗'],
  no_models_found: ['ไม่พบโมเดล', 'No models found', '未找到模型'],
  host_not_in_allowlist: ['Host "{host}" ยังไม่อยู่ใน allowlist\n\nกดตกลงเพื่อเพิ่ม "{host}" และลองใหม่ทันที', 'Host "{host}" is not in the allowlist\n\nPress OK to add "{host}" and retry immediately', '主機「{host}」不在白名單中\n\n按確定以新增「{host}」並立即重試'],
  host_added_retrying: ['เพิ่ม "{host}" แล้ว — กำลังดึงโมเดลใหม่…', 'Added "{host}" — fetching models again…', '已新增「{host}」— 正在重新獲取模型…'],
  host_cancelled: ['ยกเลิก', 'Cancelled', '已取消'],
  host_not_allowed_vps: ['Host {host} ไม่ได้รับอนุญาต — เพิ่ม hostname ใน CUSTOM_ENDPOINT_HOSTS บน server (VPS mode)', 'Host {host} is not allowed — add the hostname to CUSTOM_ENDPOINT_HOSTS on the server (VPS mode)', '主機 {host} 未獲允許 — 請在伺服器的 CUSTOM_ENDPOINT_HOSTS 中加入該主機名（VPS 模式）'],
  drawer_open_label: ['เปิดเมนู', 'Open menu', '開啟選單'],
  drawer_close_label: ['ปิดเมนู', 'Close menu', '關閉選單'],
  recent_fallback_role: ['ตัวละคร', 'Character', '角色'],
  world_control_hint: ['รูปแบบ roleplay: ข้อความใน “…” เป็นบทพูด; ข้อความระหว่าง *...* คือการกระทำ สีหน้า หรือความคิด ไม่ใช่เสียงพูด; narrative บรรยายฉากและการเคลื่อนไหวตามบริบท ห้ามแปลง *...* เป็นบทพูด ห้ามบรรยายการกระทำ/ความคิดแทนผู้ใช้', 'Roleplay format: text inside "…" is spoken dialogue; text wrapped in *...* is action, expression, or thought (not speech); narration describes scenes and movement from context. Never convert *...* into speech, and never narrate the user\'s actions or thoughts.', '角色扮演格式：「…」內的文字是对白；*...* 包裹的是動作、表情或內心活動（非口語）；旁白依上下文描寫場景與動作。切勿將 *...* 轉為對白，也不要代替用戶描寫其動作或想法。'],
  speaker_character: ['ตัวละคร', 'Character', '角色'],
  speaker_user: ['ผู้ใช้', 'User', '用戶'],
  reply_length_hint: ['ตอบให้กระชับ จบประโยคเสมอภายในงบประมาณประมาณ {n} token ห้ามทิ้งประโยคค้างกลางคัน', 'Reply concisely and always finish sentences within a budget of about {n} tokens. Never leave a sentence cut off mid-way.', '回答應簡潔，並在約 {n} token 的預算內完成句子，切勿句中斷。'],
};
const INSERT_AFTER = {
  th: '"custom_lang_copy_template": "📋 คัดลอกแม่แบบคำแปล (Template)",',
  en: '"custom_lang_copy_template": "📋 Copy Template JSON",',
  zh: '"custom_lang_copy_template": "📋 复制词典模板 JSON",',
};
function makeLines(lang){
  const pad = Math.max(0, 19 - lang.length);
  return Object.entries(NEW_KEYS).map(([k,v]) => ' '.repeat(pad)+'"'+k+'": '+JSON.stringify(v[lang==='th'?0:lang==='en'?1:2])+',').join('\n');
}
for(const [lang, marker] of Object.entries(INSERT_AFTER)){
  if(!src.includes(marker)){ console.error('MARKER NOT FOUND for '+lang); process.exit(1); }
  src = src.replace(marker, marker+'\n'+makeLines(lang));
}

// ---------- 2. Helpers + applyLocale enhancement ----------
const OLD_APPLY_HEAD = `function applyLocale(code, quiet=false){
  currentLocale = code;`;
const HELPERS = `function tr(key, fallback){
  // translate a runtime string that may already be translated via t(); avoids double lookups
  const v = t(key, fallback !== undefined ? fallback : key);
  return v === key ? (fallback !== undefined ? fallback : key) : v;
}
function localizeStaticFallbacks(){
  // update statically-rendered elements whose Thai markup doubles as an i18n fallback
  document.querySelectorAll('[data-i18n-fallback]').forEach(el => {
    const k = el.getAttribute('data-i18n-fallback');
    const dict = getActiveLocaleDict();
    if(dict[k] !== undefined){
      if(String(dict[k]).includes('<')) el.innerHTML = sanitizeI18nHtml(dict[k]);
      else el.textContent = dict[k];
    }
  });
}
function applyLocale(code, quiet=false){
  currentLocale = code;`;
if(!src.includes(OLD_APPLY_HEAD)){ console.error('applyLocale head not found'); process.exit(1); }
src = src.replace(OLD_APPLY_HEAD, HELPERS);

const OLD_DROPDOWNS = `  updateLanguageDropdowns();
  if(typeof renderCards === 'function') renderCards();`;
const NEW_DROPDOWNS = `  localizeStaticFallbacks();
  updateLanguageDropdowns();
  if(typeof renderCards === 'function') renderCards();`;
if(!src.includes(OLD_DROPDOWNS)){ console.error('dropdowns anchor not found'); process.exit(1); }
src = src.replace(OLD_DROPDOWNS, NEW_DROPDOWNS);

const OLD_TAIL = `  if(typeof renderProfilePills === 'function' && document.getElementById('userProfileModal')?.classList.contains('show')) renderProfilePills();
}`;
const NEW_TAIL = `  if(typeof renderProfilePills === 'function' && document.getElementById('userProfileModal')?.classList.contains('show')) renderProfilePills();
  if(typeof updateRecentMiniList === 'function') updateRecentMiniList();
  if(typeof toggleSound === 'function') toggleSound(soundOn);
  if(typeof refreshCharInfoModal === 'function') refreshCharInfoModal();
}`;
if(!src.includes(OLD_TAIL)){ console.error('applyLocale tail not found'); process.exit(1); }
src = src.replace(OLD_TAIL, NEW_TAIL);

// ---------- 3. toggleSound(setTo) so it can re-label without toggling ----------
const OLD_TS = `function toggleSound(){soundOn=!soundOn;localStorage.setItem('hush-sound',soundOn?'on':'off');const b=document.getElementById('soundToggle');if(b){b.classList.toggle('sound-off',!soundOn);b.classList.toggle('sound-toggle-active',soundOn);b.title=soundOn?'ปิดเสียงเอฟเฟกต์':'เปิดเสียงเอฟเฟกต์';b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed',String(soundOn))}if(soundOn)playSfx('toggle')}`;
if(!src.includes(OLD_TS)){ console.error('toggleSound not found'); process.exit(1); }
const NEW_TS = `function toggleSound(setTo){const next=(typeof setTo==='boolean')?setTo:!soundOn;const changed=next!==soundOn;soundOn=next;localStorage.setItem('hush-sound',soundOn?'on':'off');const b=document.getElementById('soundToggle');if(b){b.classList.toggle('sound-off',!soundOn);b.classList.toggle('sound-toggle-active',soundOn);b.title=soundOn?t('btn_sound_on','ปิดเสียงเอฟเฟกต์'):t('btn_sound_off','เปิดเสียงเอฟเฟกต์');b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed',String(soundOn))}if(changed&&soundOn)playSfx('toggle')}`;
src = src.replace(OLD_TS, NEW_TS);

// ---------- 4. replace hardcoded UI strings with t() ----------
const REPLACEMENTS = [
  [`showToast('รหัสภาษาต้องเป็นตัวอักษร 2-10 ตัว (เช่น ja, es, fr)');`, `showToast(t('toast_lang_code_invalid','รหัสภาษาต้องเป็นตัวอักษร 2-10 ตัว (เช่น ja, es, fr)'));`],
  [`showToast('กรุณาระบุชื่อภาษาที่แสดง');`, `showToast(t('toast_lang_name_required','กรุณาระบุชื่อภาษาที่แสดง'));`],
  [`showToast('ข้อมูล JSON ไม่ถูกต้อง กรุณาตรวจสอบไวยากรณ์');`, `showToast(t('toast_lang_json_invalid','ข้อมูล JSON ไม่ถูกต้อง กรุณาตรวจสอบไวยากรณ์'));`],
  [`{name:n,role:'ตัวละคร',avatar:n[0]||'✦',art:'a2'}`, `{name:n,role:t('recent_fallback_role','ตัวละคร'),avatar:n[0]||'✦',art:'a2'}`],
  [`function buildWorldControlHint(){return 'รูปแบบ roleplay: ข้อความใน “…” เป็นบทพูด; ข้อความระหว่าง *...* คือการกระทำ สีหน้า หรือความคิด ไม่ใช่เสียงพูด; narrative บรรยายฉากและการเคลื่อนไหวตามบริบท ห้ามแปลง *...* เป็นบทพูด ห้ามบรรยายการกระทำ/ความคิดแทนผู้ใช้'}`,
   `function buildWorldControlHint(){return t('world_control_hint','รูปแบบ roleplay: ข้อความใน “…” เป็นบทพูด; ข้อความระหว่าง *...* คือการกระทำ สีหน้า หรือความคิด ไม่ใช่เสียงพูด; narrative บรรยายฉากและการเคลื่อนไหวตามบริบท ห้ามแปลง *...* เป็นบทพูด ห้ามบรรยายการกระทำ/ความคิดแทนผู้ใช้')}`],
  [`(m.role==='assistant'?'ตัวละคร':'ผู้ใช้')`, `(m.role==='assistant'?t('speaker_character','ตัวละคร'):t('speaker_user','ผู้ใช้'))`],
  [`return 'ตอบให้กระชับ จบประโยคเสมอภายในงบประมาณประมาณ '+b+' token ห้ามทิ้งประโยคค้างกลางคัน'`,
   `return t('reply_length_hint','ตอบให้กระชับ จบประโยคเสมอภายในงบประมาณประมาณ {n} token ห้ามทิ้งประโยคค้างกลางคัน').replace('{n}',b)`],
  [`button.setAttribute('aria-label',opened?'ปิดเมนู':'เปิดเมนู');`, `button.setAttribute('aria-label',opened?t('drawer_close_label','ปิดเมนู'):t('drawer_open_label','เปิดเมนู'));`],
  [`reject(new Error('เลือกไฟล์ PNG, JPG หรือ WebP'))`, `reject(new Error(tr('file_type_error','เลือกไฟล์ PNG, JPG หรือ WebP')))`],
  [`reject(new Error('ไฟล์ภาพใหญ่เกิน 3 MB'))`, `reject(new Error(tr('file_size_error','ไฟล์ภาพใหญ่เกิน 3 MB')))`],
  [`reject(new Error('อ่านไฟล์ภาพไม่ได้'))`, `reject(new Error(tr('file_read_error','อ่านไฟล์ภาพไม่ได้')))`],
  [`showToast(e.message||'เลือกภาพไม่สำเร็จ')`, `showToast(e.message||t('image_pick_failed','เลือกภาพไม่สำเร็จ'))`],
  [`showToast('สร้าง Persona ใหม่แล้ว')`, `showToast(t('persona_created','สร้าง Persona ใหม่แล้ว'))`],
  ["showToast(`บันทึก Persona \"${p.name}\" แล้ว`)", `showToast(t('persona_saved','บันทึก Persona "{name}" แล้ว').replace('{name}',p.name))`],
  [`showToast('กรุณาระบุชื่อ Persona ของคุณ')`, `showToast(t('persona_name_required','กรุณาระบุชื่อ Persona ของคุณ'))`],
  [`showToast('ต้องมี Persona อย่างน้อย 1 รายการ')`, `showToast(t('persona_min_one','ต้องมี Persona อย่างน้อย 1 รายการ'))`],
  [`showToast('ลบ Persona แล้ว')`, `showToast(t('persona_deleted','ลบ Persona แล้ว'))`],
  [`showToast('ยังไม่มีข้อความให้ลองใหม่')`, `showToast(t('retry_no_messages','ยังไม่มีข้อความให้ลองใหม่'))`],
  [`showToast(e.message||'คุยกับ AI ไม่สำเร็จ')`, `showToast(e.message||t('ai_chat_failed','คุยกับ AI ไม่สำเร็จ'))`],
  [`throw new Error('ลบไม่สำเร็จ')`, `throw new Error(t('del_char_failed','ลบไม่สำเร็จ'))`],
  [`showToast(e.message||'ลบตัวละครไม่สำเร็จ')`, `showToast(e.message||t('del_char_generic','ลบตัวละครไม่สำเร็จ'))`],
  [`showToast('ไม่พบข้อมูลตัวละคร')`, `showToast(t('char_info_not_found','ไม่พบข้อมูลตัวละคร'))`],
  [`c.name||'ข้อมูลตัวละคร'`, `c.name||t('info_modal_default_title','ข้อมูลตัวละคร')`],
  [`c.appearance||'ไม่ระบุ'`, `c.appearance||t('info_unspecified','ไม่ระบุ')`],
  [`showToast('ยังไม่มีบทสนทนาให้บันทึก')`, `showToast(t('chat_empty_export','ยังไม่มีบทสนทนาให้บันทึก'))`],
  [`showToast('บันทึกเรื่องราวเป็นไฟล์ Markdown แล้ว')`, `showToast(t('export_md_done','บันทึกเรื่องราวเป็นไฟล์ Markdown แล้ว'))`],
  [`showToast('ยังไม่มีบทสนทนา')`, `showToast(t('chat_empty_copy','ยังไม่มีบทสนทนา'))`],
  [`showToast('คัดลอกบทสนทนาแล้ว')`, `showToast(t('copied_chat','คัดลอกบทสนทนาแล้ว'))`],
  [`showToast('เบราว์เซอร์ไม่รองรับคลิปบอร์ด')`, `showToast(t('copy_clipboard_unsupported','เบราว์เซอร์ไม่รองรับคลิปบอร์ด'))`],
  [`document.getElementById('charName').value||'ชื่อตัวละคร'`, `document.getElementById('charName').value||t('preview_default_name','ชื่อตัวละคร')`],
  [`document.getElementById('charRole').value||'บทบาทของตัวละคร'`, `document.getElementById('charRole').value||t('preview_default_role','บทบาทของตัวละคร')`],
  [`showToast('ใส่ชื่อตัวละครก่อน')`, `showToast(t('save_char_name_required','ใส่ชื่อตัวละครก่อน'))`],
  [`c.role=c.role||'ตัวละครใหม่'`, `c.role=c.role||t('default_new_char_role','ตัวละครใหม่')`],
  [`c.desc=c.desc||'ตัวละครที่คุณสร้างเอง'`, `c.desc=c.desc||t('default_new_char_desc','ตัวละครที่คุณสร้างเอง')`],
  [`c.greeting=c.greeting||'สวัสดี ยินดีที่ได้พบกัน'`, `c.greeting=c.greeting||t('default_greeting','สวัสดี ยินดีที่ได้พบกัน')`],
  [`button.textContent='กำลังบันทึก…'`, `button.textContent=t('saving_btn','กำลังบันทึก…')`],
  [`throw new Error(saved.error||'บันทึกตัวละครไม่สำเร็จ')`, `throw new Error(saved.error||t('char_save_failed','บันทึกตัวละครไม่สำเร็จ'))`],
  [`showToast('สร้างตัวละครและบันทึกแล้ว')`, `showToast(t('char_created','สร้างตัวละครและบันทึกแล้ว'))`],
  [`showToast(e.message||'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')`, `showToast(e.message||t('server_connect_failed','เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'))`],
  [`button.textContent='สร้างตัวละคร'`, `button.textContent=t('create_submit_btn','สร้างตัวละคร')`],
  [`showToast('ใส่ model ID ก่อน')`, `showToast(t('model_id_required','ใส่ model ID ก่อน'))`],
  [`showToast('ใช้โมเดล '+v)`, `showToast(t('manual_model_used','ใช้โมเดล {model}').replace('{model}',v))`],
  [`showToast('คืนค่าพรอมต์หลักแล้ว')`, `showToast(t('prompt_reset_done','คืนค่าพรอมต์หลักแล้ว'))`],
  [`showToast('ใส่ hostname ก่อน')`, `showToast(t('host_add_required','ใส่ hostname ก่อน'))`],
  [`d.error||'เพิ่ม host ไม่ได้'`, `d.error||t('host_add_failed','เพิ่ม host ไม่ได้')`],
  [`d.error||'ลบ host ไม่ได้'`, `d.error||t('host_del_failed','ลบ host ไม่ได้')`],
  [`catch{showToast('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')}`, `catch{showToast(t('server_connect_failed','เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'))}`],
  [`confirm('Host "'+d.host+'" ยังไม่อยู่ใน allowlist\\n\\nกดตกลงเพื่อเพิ่ม "'+d.host+'" และลองใหม่ทันที')`,
   `confirm(t('host_not_in_allowlist','Host "{host}" ยังไม่อยู่ใน allowlist\\n\\nกดตกลงเพื่อเพิ่ม "{host}" และลองใหม่ทันที').split('{host}').join(d.host))`],
  [`showToast('เพิ่ม "'+d.host+'" แล้ว — กำลังดึงโมเดลใหม่…')`, `showToast(t('host_added_retrying','เพิ่ม "{host}" แล้ว — กำลังดึงโมเดลใหม่…').replace('{host}',d.host))`],
  [`b.textContent='ดึงโมเดล'`, `b.textContent=t('settings_fetch_models','ดึงโมเดล')`],
  [`showToast('ยกเลิก')`, `showToast(t('host_cancelled','ยกเลิก'))`],
  [`showToast('Host '+d.host+' ไม่ได้รับอนุญาต — เพิ่ม hostname ใน CUSTOM_ENDPOINT_HOSTS บน server (VPS mode)')`,
   `showToast(t('host_not_allowed_vps','Host {host} ไม่ได้รับอนุญาต — เพิ่ม hostname ใน CUSTOM_ENDPOINT_HOSTS บน server (VPS mode)').replace('{host}',d.host))`],
  [`throw new Error(d.error||'ดึงโมเดลไม่สำเร็จ')`, `throw new Error(d.error||t('fetch_models_fail','ดึงโมเดลไม่สำเร็จ'))`],
  [`showToast('ไม่พบโมเดล')`, `showToast(t('no_models_found','ไม่พบโมเดล'))`],
];
let miss = [];
for(const [from,to] of REPLACEMENTS){
  if(!src.includes(from)){ miss.push(from.slice(0,60)); continue; }
  src = src.split(from).join(to);
}
if(miss.length){ console.error('NOT FOUND:', miss); process.exit(1); }

fs.writeFileSync(P, src);
console.log('OK. size delta:', src.length - origLen);
