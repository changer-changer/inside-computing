(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { phase: 'predict', step: 0 };
  let initialRender = true;
  const choices = (items, handler) => {
    const root = $('taskContent'); root.replaceChildren();
    items.forEach(([value, label]) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'choice';
      const text = document.createElement('span'); text.textContent = label;
      const arrow = document.createElement('span'); arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true');
      button.append(text, arrow); button.addEventListener('click', () => handler(value, button)); root.append(button);
    });
  };
  function action(label, handler, secondary = false) {
    const b = document.createElement('button'); b.type = 'button'; b.className = secondary ? 'secondary-btn' : 'action-btn';
    b.append(document.createTextNode(label)); const arrow = document.createElement('span'); arrow.textContent = '→'; arrow.setAttribute('aria-hidden', 'true'); b.append(arrow); b.addEventListener('click', handler); $('taskContent').append(b);
  }
  function feedback(message, isError = false) { const el = $('feedback'); el.hidden = false; el.classList.toggle('error', isError); el.textContent = message; }
  function clearFeedback() { $('feedback').hidden = true; $('feedback').textContent = ''; }
  function setTask(kicker, title, description, hint) { $('taskKicker').textContent = kicker; $('taskTitle').textContent = title; $('taskDescription').textContent = description; $('stepHint').textContent = hint; }
  function visual(pc, ir, active, flow, observation, number) {
    $('pcValue').textContent = pc; $('irValue').textContent = ir;
    ['pcBox', 'irBox', 'mem100', 'mem104'].forEach(id => $(id).classList.toggle('active', active.includes(id)));
    $('flow').classList.toggle('on', flow !== '等待开始'); $('flow').classList.toggle('reverse', flow === '读取数据' || flow === '读取完成'); $('flowLabel').textContent = flow;
    $('observation').textContent = observation; $('obsNumber').textContent = number;
  }
  function lockChoices(button, right) {
    button.classList.add(right ? 'correct' : 'wrong');
    if (right) $('taskContent').querySelectorAll('.choice').forEach(el => { el.disabled = true; });
  }
  function render() {
    clearFeedback(); $('taskContent').replaceChildren();
    if (state.phase === 'predict') {
      $('progressLabel').textContent = '01 / 04 预测';
      visual('0x0100', '—', ['pcBox'], '等待开始', 'PC 里保存着下一条指令的地址。先看看右侧的问题。', '01');
      setTask('第一步 · 先预测', 'CPU 会去哪里找指令？', '此时 PC = 0x0100。选择 CPU 首先要访问的存储器地址。', '可以先试着选一个答案');
      choices([['100','0x0100'], ['104','0x0104'], ['2a','0x2A']], (v,b) => {
        if (v !== '100') { lockChoices(b,false); feedback(v === '2a' ? '0x2A 是这个例子中的存储内容。PC 给出的是要访问的地址，再试一次。' : '看一看 PC 当前保存的值：它指向下一条指令的地址。', true); return; }
        lockChoices(b,true); feedback('对，PC 的值是 0x0100，因此 CPU 从这个地址读取。接下来亲手观察。');
        action('开始取指', () => { state.phase='observe'; state.step=0; render(); }); $('stepHint').textContent='预测完成';
      });
    } else if (state.phase === 'observe') {
      $('progressLabel').textContent = '02 / 04 观察';
      const steps = [
        ['0x0100','—',['pcBox'],'等待开始','PC 指向 0x0100。点击右侧按钮，跟随一次取指。','01','准备好了','观察取指时，地址和数据各自去了哪里。','开始取指'],
        ['0x0100','—',['pcBox','mem100'],'送出地址','CPU 使用 PC 中的 0x0100 访问存储器；地址告诉存储器要找哪个位置。','02','第一步：送出地址','地址 0x0100 指向存储器中的一个位置。','读取这个位置'],
        ['0x0100','0x2A',['irBox','mem100'],'读取数据','存储器返回该地址中的 0x2A。这个字节进入指令寄存器 IR。','03','第二步：读入指令','0x0100 是地址，0x2A 是该地址里的内容。','更新 PC'],
        ['0x0101','0x2A',['pcBox','irBox'],'取指完成','在本模型中，此指令占一个字节，所以 PC 从 0x0100 变为 0x0101。','04','第三步：准备下一条','IR 保存刚读取的指令；PC 指向下一个字节。','试试新情境']
      ];
      const s=steps[state.step]; visual(...s.slice(0,6));
      setTask('第二步 · 动手观察',s[6],s[7],`取指过程 ${state.step} / 3`);
      action(s[8], () => { if(state.step<3){ state.step++; render(); } else {state.phase='transfer'; render();} });
      if (state.step>0) action('上一步', () => { state.step--; render(); }, true);
    } else if (state.phase === 'transfer') {
      $('progressLabel').textContent='03 / 04 迁移';
      visual('0x0104','—',['pcBox'],'等待开始','换一个起点：PC 现在是 0x0104。读取前，先独立判断。','05');
      setTask('第三步 · 换个条件', '这次 IR 会得到什么？', 'PC = 0x0104。假设取指顺利完成，IR 会保存哪个值？', '提示：先找到地址，再看内容');
      choices([['100','0x0100'],['104','0x0104'],['73','0x73']],(v,b)=>{
        if(v!=='73'){lockChoices(b,false);feedback(v==='104'?'0x0104 是地址。IR 保存从这个地址读出的指令内容。':'先用 PC 中的地址找到对应行，再查看这一行的内容。',true);return;}
        lockChoices(b,true);visual('0x0104','0x73',['irBox','mem104'],'读取数据','地址 0x0104 中的内容是 0x73，因此 IR 读到 0x73。','05');
        feedback('正确。PC 指向地址，存储器提供内容，IR 保存读到的指令。');
        action('完成实验',()=>{state.phase='finish';render();});$('stepHint').textContent='迁移题完成';
      });
    } else {
      $('progressLabel').textContent='04 / 04 完成';
      visual('0x0104','0x73',['irBox','mem104'],'读取完成','PC 提供位置，存储器返回内容，IR 接收指令。你可以重新尝试或进入 3D 解剖台。','06');
      setTask('实验完成', '你追踪了一次取指。','试着不看图解释：为什么 PC 里的地址和 IR 里的指令不是同一件事？','学习记录只保存在本次页面中');
      action('再试一次',()=>{state.phase='predict';state.step=0;render();});
      const link=document.createElement('a');link.href='legacy/computer-anatomy.html';link.className='secondary-btn';link.textContent='去 3D 解剖台探索 ↗';link.style.display='block';$('taskContent').append(link);
    }
    if (!initialRender) $('taskTitle').focus({ preventScroll: true });
    initialRender = false;
  }
  $('restart').addEventListener('click',()=>{state.phase='predict';state.step=0;render();});
  $('modelInfo').addEventListener('click',()=>{const note=$('modelNote');note.hidden=!note.hidden;$('modelInfo').setAttribute('aria-expanded',String(!note.hidden));$('modelInfo').querySelector('span').textContent=note.hidden?'+':'−';});
  render();
})();
