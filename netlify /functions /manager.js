// netlify/functions/manager.js
const fetch = require('node-fetch');
const FormData = require('form-data');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    const body = JSON.parse(event.body);
    const { action, token, rules } = body; // rules هنا هو محتوى ملف JSON كنص
    
    // إعدادات البوت المضيف (يجب وضعها في Netlify Environment Variables)
    const HOST_BOT_TOKEN = process.env.HOST_BOT_TOKEN; 
    const DB_CHANNEL_ID = process.env.DB_CHANNEL_ID; 

    const siteUrl = process.env.URL || "https://YOUR-SITE.netlify.app"; 

    if (action === 'deploy') {
        let rulesFileId = "";

        // 1. إذا وجد ملف قواعد، نرفعه لقناة التخزين
        if (rules) {
            try {
                // ننشئ ملفاً وهمياً ونرفعه
                const formData = new FormData();
                formData.append('chat_id', DB_CHANNEL_ID);
                formData.append('document', Buffer.from(rules, 'utf-8'), { filename: 'rules.json' });
                formData.append('caption', `Rules for bot: ${token.substring(0, 10)}...`);

                const uploadRes = await fetch(`https://api.telegram.org/bot${HOST_BOT_TOKEN}/sendDocument`, {
                    method: 'POST',
                    body: formData
                });
                const uploadData = await uploadRes.json();
                
                if (!uploadData.ok) throw new Error("فشل رفع ملف القواعد لقناة التخزين");
                
                rulesFileId = uploadData.result.document.file_id;
            } catch (e) {
                return { statusCode: 500, body: JSON.stringify({ ok: false, description: e.message }) };
            }
        }

        // 2. ضبط الويب هوك مع تضمين معرف الملف في الرابط
        // لاحظ: نمرر file_id في الرابط ليعرف المعالج أين يجد القواعد
        const webhookUrl = `${siteUrl}/api/webhook?target_token=${token}&fid=${rulesFileId}`;
        
        const tgUrl = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
        const response = await fetch(tgUrl);
        const result = await response.json();

        return { statusCode: 200, body: JSON.stringify(result) };
    }

    return { statusCode: 400, body: 'Unknown action' };
};
