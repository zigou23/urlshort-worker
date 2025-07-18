const html404 = `URL not found`;
const htmlerror = `ERROR`;
const ADMIN_PASSWORD = 'your_password_here'; // 环境变量中设置 没做
//到此处添加Turnstile https://dash.cloudflare.com/sign-up?to=/:account/turnstile
const siteKey = '0x4AAAAAAAAAAAAAAWFyaKx'; //Turnstile站点密钥 env.SITE_KEY || 
const SECRET_KEY = '0x4AAAAAABAAAAAw-6AAAAAAM9AAAAAAYM'; //Turnstile密钥 env.SECRET_KEY || 
//新建kv,并去绑定那里绑定kv，LINKS=kv名

async function randomString(len = 4) {
    const $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz1234567890';
    let result = '';
    for (let i = 0; i < len; i++) {
        result += $chars.charAt(Math.floor(Math.random() * $chars.length));
    }
    return result;
}

//过期时间
function calculateExpiration(option) {
    const now = Date.now();
    const durations = {
        '1week': 7 * 86400 * 1000,
        '1month': 30 * 86400 * 1000,
        '3months': 90 * 86400 * 1000,
        '6months': 180 * 86400 * 1000,
        // '1year': 365 * 86400 * 1000,
        // 'permanent': 0
    };
    return option in durations ? now + durations[option] : 0;
}

//url检测
async function checkURL(url) {
    const pattern = /^(https?:\/\/)([\w-]+\.)+[\w-]+(\/[\w\-./?%&=]*)?$/;
    return pattern.test(url);
}

//cf Turnstile验证码
async function validateTurnstile(token, secretKey) {
    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    
    const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    const result = await fetch(url, {
      body: formData,
      method: 'POST',
    });
    
    return await result.json();
  }
  

async function handleRequest(request) {
    const url = new URL(request.url);
    const path = url.pathname.split('/')[1];
    const params = url.searchParams;

    // 优先处理短链接重定向
    if (path && path !== 'urlshort') {
        if (path === 'favicon.ico') {
            return Response.redirect('https://qsim.top/favicon.ico', 301);
        }
        const value = await LINKS.get(path);
        
        if (value) {
            const meta = JSON.parse(value);
            
            // 检查过期时间
            if (meta.expires !== 0 && Date.now() > meta.expires) {
                await LINKS.delete(path);
                return new Response(html404, {status: 404});
            }

            // 更新访问次数
            meta.visits = (meta.visits || 0) + 1;
            await LINKS.put(path, JSON.stringify(meta));

            return Response.redirect(`https://return-x.netlify.app/return/all/?url=${encodeURIComponent(meta.url.replace(/^https?:\/\//, ''))}`, 302);
            //直接跳转 return Response.redirect(meta.url, 302);
        }else{ // 如果短链接不存在，继续后续处理
            return new Response(htmlerror, {status: 404}); //注意没后台管理
        }
    }

    // 管理后台功能,没做

    // 处理POST请求
    if (request.method === 'POST' && path == 'urlshort') {
        const data = await request.json();
        console.log('Received data:', data);
        if (!data.turnstileToken) {
            return new Response(JSON.stringify({error: '未经过验证'}), {status: 400});
        }else{ //验证框架
            const cfresponse = await validateTurnstile(data.turnstileToken, SECRET_KEY);
            if (!cfresponse.success){
                return new Response(JSON.stringify({error: '验证失败'}), {status: 400});
            }
        }
        
        if (!await checkURL(data.url)) {
            return new Response(JSON.stringify({error: 'URL不合法'}), {status: 400});
        }

        // 高级功能验证
        // if ((data.customSuffix || data.expire === '1year') && data.password !== ADMIN_PASSWORD) {
        //     return new Response(JSON.stringify({error: '需要管理员密码'}), {status: 403});
        // }

        // 生成短码
        let key = data.customSuffix || await randomString();
        if (await LINKS.get(key)) {
            return new Response(JSON.stringify({error: '短码已存在'}), {status: 409});
        }

        // 存储元数据
        const meta = {
            url: data.url,
            created: Date.now(),
            expires: calculateExpiration(data.expire || 'permanent'),
            visits: 0
        };
        await LINKS.put(key, JSON.stringify(meta));
        return new Response(JSON.stringify({key: `/${key}`}));
    }

    // 默认返回前端页面，由于使用了${siteKey}，所以无法使用
    // const page = await fetch('https://return-x.netlify.app/short-url/');
    // if (url.pathname == '/') {
    //     return new Response(await page.text(), {
    //         headers: {'Content-Type': 'text/html; charset=UTF-8'}
    //     });
    // }
    const html = `
    <!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <link rel="icon" type="image/x-icon" href="https://qsim.top/favicon.ico">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
    <title>短链</title>
    <style>
        :root {
            --primary: #4F46E5;
            --success: #10B981;
            --danger: #EF4444;
            --bg: #f8fafc;
        }
        * {
            box-sizing: border-box;
            font-family: 'Segoe UI', system-ui, sans-serif;
        }
        body {
            margin: 0;
            padding: 2rem;
            min-height: 100vh;
            background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
        }
        .container {
            max-width: 400px;
            margin: 0 auto;
            background: white;
            border-radius: 1rem;
            box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
            padding: 2rem;
        }
        h1 {
            /* text-align: center; */
            color: #1e293b;
            margin: 0 0 2rem;
            font-size: 2rem;
        }
        .form-group {
            margin-bottom: 1.3rem;
        }
        .form-group:last-child {
            margin-bottom: 0;
        }
        label {
            display: block;
            margin-bottom: 0.5rem;
            color: #64748b;
            font-weight: 500;
        }
        input, select {
            width: 100%;
            padding: 0.75rem 4px;
            /* border: 2px solid #e2e8f0;
            border-radius: 0.5rem; */
            font-size: 1rem;
            transition: border-color 0.2s;
            border: none;
            border-bottom: 1px solid rgba(0, 0, 0, .42);
        }
        input:focus, select:focus {
            outline: none;
            border-color: var(--primary);
            /*box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);*/
            box-shadow: 0 1px 0px 0px rgba(0, 0, 0, 0.2);
        }
        .form-group:focus-within label{
            color: #1e293b;
        }
        button {
            width: 100%;
            padding: 1rem;
            background: var(--primary);
            color: white;
            border: none;
            border-radius: 0.5rem;
            font-size: 1.1rem;
            font-weight: 600;
            cursor: pointer;
            transition: opacity 0.2s;
        }
        button:hover {
            opacity: 0.9;
        }
        .result-box {
            margin-top: 2rem;
            padding: 1.5rem;
            background: #f8fafc;
            border-radius: 0.5rem;
            display: none;
        }
        .result-box.active {
            display: block;
        }
        .short-url {
            color: var(--primary);
            font-weight: 600;
            word-break: break-all;
        }
        .copy-btn {
            margin-top: 1rem;
            background: var(--success);
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            color: white;
            border: none;
            cursor: pointer;
        }
        .error-box {
            color: var(--danger);
            padding: 1rem;
            background: #fee2e2;
            border-radius: 0.5rem;
            margin-bottom: 1rem;
            display: none;
        }
        button:disabled {
            background-color: #aaa;
            cursor: not-allowed;
            color: #eee;
        }
        .cf-turnstile-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            display: none;
        }
        .cf-turnstile-container {
            background: white;
            padding: 2rem;
            border-radius: 0.5rem;
            text-align: center;
        }
        .cf-turnstile-container p {
            margin-bottom: 1rem;
            color: #1e293b;
        }
        footer p, footer a {
            color: gray;
            text-decoration: none;
            text-align: center;
        }
        @media (max-width: 640px) {
            body {
                padding: 1rem;
            }
            .container {
                padding: 1.5rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>短链</h1>

        <div class="error-box" id="error"></div>

        <form id="shortenForm">
            <div class="form-group">
                <label for="url">长链接地址</label>
                <input type="url" id="url" required placeholder="https://example.com/very-long-url">
            </div>
            
            <div class="form-group">
                <label for="expire">有效期</label>
                <select id="expire">
                    <option value="1week">1周</option>
                    <option value="1month">1个月</option>
                    <option value="3months">3个月</option>
                    <option value="6months">6个月</option>
                    <!-- <option value="1year">1年</option> -->
                    <!-- <option value="permanent">永久</option> -->
                </select>
            </div>
            
            <button type="button" id="submit-btn">生成短链</button>
            
        </form>
        
        <div class="result-box" id="result">
            <div>生成的短链接：</div>
            <a class="short-url" id="shortUrl" target="_blank"></a>
            <button class="copy-btn" onclick="copyUrl()">复制链接</button>
        </div>
    </div>

    <!-- Cloudflare Turnstile 验证码模态框 -->
    <div class="cf-turnstile-modal" id="cfModal">
        <div class="cf-turnstile-container">
            <p>请完成验证以继续</p>
            <div id="cfWidget"></div>
        </div>
    </div>

    <script>
        const form = document.getElementById('shortenForm');
        const errorBox = document.getElementById('error');
        const resultBox = document.getElementById('result');
        const shortUrl = document.getElementById('shortUrl');
        const submitBtn = document.getElementById('submit-btn');
        const cfModal = document.getElementById('cfModal');
        const cfWidget = document.getElementById('cfWidget');
        const siteKey = "${siteKey}"; // 在脚本中使用定义好的siteKey
        let turnstileToken = '';
        let turnstileWidgetId = null;

        // 点击提交按钮时显示验证码模态框
        submitBtn.addEventListener('click', () => {
            // 验证表单输入
            if (!form.url.value) {
                showError('请输入长链接地址');
                return;
            }
            
            // 显示验证码模态框
            cfModal.style.display = 'flex';
            
            // 加载Turnstile验证码
            if (!turnstileWidgetId) {
                turnstileWidgetId = turnstile.render(cfWidget, {
                    sitekey: siteKey,
                    theme: 'light',
                    callback: onTurnstileSuccess
                });
            } else {
                turnstile.reset(turnstileWidgetId);
            }
        });

        function onTurnstileSuccess(token) {
            turnstileToken = token;
            cfModal.style.display = 'none';
            submitForm();
        }

        async function submitForm() {
            submitBtn.disabled = true;
            const data = {
                url: form.url.value,
                expire: form.expire.value,
                turnstileToken: turnstileToken,
            };
            
            try {
                const response = await fetch('/urlshort', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                const result = await response.json();
                
                if (response.ok) {
                    errorBox.style.display = 'none';
                    const fullUrl = window.location.origin + result.key;
                    shortUrl.href = fullUrl;
                    shortUrl.textContent = fullUrl;
                    resultBox.classList.add('active');
                } else {
                    showError(result.error || '请求失败');
                }
            } catch (err) {
                showError('网络请求失败，请稍后重试');
            } finally {
                submitBtn.disabled = false;
                turnstileToken = '';
            }
        }

        function showError(message) {
            errorBox.textContent = message;
            errorBox.style.display = 'block';
            resultBox.classList.remove('active');
        }

        function copyUrl() {
            navigator.clipboard.writeText(shortUrl.href)
                .then(() => alert('链接已复制到剪贴板'))
                .catch(() => alert('复制失败，请手动复制'));
        }

        // 点击模态框背景关闭模态框
        cfModal.addEventListener('click', (e) => {
            if (e.target === cfModal) {
                cfModal.style.display = 'none';
                submitBtn.disabled = false;
            }
        });
    </script>
    <footer><p>© <a href="//qsim.top">QSIM</a></p></footer>
</body>
</html>
    `;
    if (url.pathname == '/') {
        return new Response(html, {
        headers: {
            'Content-Type': 'text/html; charset=UTF-8',
        },
        });
    }
}

addEventListener('fetch', e => e.respondWith(handleRequest(e.request)));
